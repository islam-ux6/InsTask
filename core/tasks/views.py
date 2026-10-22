from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from .models import Task, TaskReport, TaskStatusLog
from .serializers import TaskSerializer, TaskReportSerializer
from .permissions import IsTaskParticipant, IsAssigneeForAccept 


def transition_task_status(task, old_status, new_status):
    if task.status == new_status:
        return

    last_log = task.status_logs.order_by('-entered_at').first()
    if last_log and last_log.status == new_status:
        return

    task.status_logs.filter(exited_at__isnull=True).update(exited_at=timezone.now())

    task.status = new_status
    if new_status == Task.Status.REVISION:
        task.revision_count += 1
    if new_status == Task.Status.COMPLETED:
        task.completed_at = timezone.now()
    
    task.save()

    TaskStatusLog.objects.create(task=task, status=new_status)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskParticipant] 

    def get_queryset(self):
        user = self.request.user
        base_qs = Task.objects.all().select_related('creator').prefetch_related(
            'assignees', 'target_departments', 'reports', 'status_logs', 'subtasks', 'subtasks__assignees'
        )

        # 1. Ректорат и Деканат видят все задачи института
        if user.is_rectorate or user.position in ['dean', 'deputy_dean']:
            return base_qs.distinct()

        # 2. Заведующий кафедрой видит только задачи, связанные с его кафедрой
        if user.position == 'head_of_department' and user.department:
            return base_qs.filter(
                Q(creator=user) |
                Q(assignees=user) |
                Q(target_departments=user.department) |
                Q(assignees__department=user.department) |
                Q(creator__department=user.department)
            ).distinct()

        # 3. Преподаватели видят свои задачи, задачи своей кафедры и созданные ими подзадачи
        return base_qs.filter(
            Q(assignees=user) | Q(target_departments=user.department) | Q(creator=user)
        ).distinct()

    def perform_create(self, serializer):
        instance = serializer.save(creator=self.request.user)
        TaskStatusLog.objects.create(task=instance, status=instance.status)

    def perform_update(self, serializer):
        instance = serializer.instance 
        old_status = instance.status 
        new_status = serializer.validated_data.get('status')

        if new_status and new_status != old_status:
            serializer.validated_data.pop('status')
            transition_task_status(instance, old_status, new_status)

        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAssigneeForAccept])
    def accept(self, request, pk=None):
        task = self.get_object()

        if task.status != Task.Status.CREATED:
            return Response(
                {"error": "Вы можете принять в работу только новые задачи."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        old_status = task.status
        transition_task_status(task, old_status, Task.Status.IN_PROGRESS)
        
        serializer = self.get_serializer(task)
        return Response(serializer.data)


class TaskReportViewSet(viewsets.ModelViewSet):
    queryset = TaskReport.objects.all().select_related('author', 'task')
    serializer_class = TaskReportSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        report = serializer.save(author=user)
        task = report.task

        # ИСПРАВЛЕНО: Автоматический перевод в "На проверке" срабатывает ТОЛЬКО если отчет
        # отправляет исполнитель задачи, а не сам постановщик/проверяющий
        is_assignee = task.assignees.filter(id=user.id).exists() or (
            user.department is not None and task.target_departments.filter(id=user.department.id).exists()
        )
        is_creator = (task.creator == user)

        if is_assignee and not is_creator and task.status in [Task.Status.IN_PROGRESS, Task.Status.REVISION]:
            old_status = task.status
            transition_task_status(task, old_status, Task.Status.ON_REVIEW)