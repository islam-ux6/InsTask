from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from .models import Task, TaskReport, TaskStatusLog
from .serializers import TaskSerializer, TaskReportSerializer
from .permissions import IsTaskParticipant, IsAssigneeForAccept 


# --- БЕЗОПАСНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ---
# Теперь она жестко требует передать old_status, чтобы не было путаницы!
def transition_task_status(task, old_status, new_status):
    if old_status == new_status:
        return

    # 1. Останавливаем секундомер именно для СТАРОГО статуса
    last_log = task.status_logs.filter(status=old_status, exited_at__isnull=True).last()
    if last_log:
        last_log.exited_at = timezone.now()
        last_log.save(update_fields=['exited_at'])

    # 2. Обновляем задачу
    task.status = new_status
    if new_status == Task.Status.REVISION:
        task.revision_count += 1
    if new_status == Task.Status.COMPLETED:
        task.completed_at = timezone.now()
    
    task.save()

    # 3. Запускаем новый секундомер
    TaskStatusLog.objects.create(task=task, status=new_status)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskParticipant] 

    def get_queryset(self):
        user = self.request.user
        base_qs = Task.objects.all().select_related('creator').prefetch_related(
            'assignees', 'target_departments', 'reports'
        )

        if user.is_rectorate or user.is_manager:
            return base_qs.distinct()

        return base_qs.filter(
            Q(assignees=user) | Q(target_departments=user.department)
        ).distinct()

    def perform_create(self, serializer):
        instance = serializer.save(creator=self.request.user)
        TaskStatusLog.objects.create(task=instance, status=instance.status)

    def perform_update(self, serializer):
        instance = serializer.instance 
        old_status = instance.status # ЗАПОМИНАЕМ СТАТУС ДО СОХРАНЕНИЯ!
        new_status = serializer.validated_data.get('status')

        if new_status and new_status != old_status:
            serializer.validated_data.pop('status')
            # Передаем старый и новый статус явно
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
    queryset = TaskReport.objects.all()
    serializer_class = TaskReportSerializer

    def perform_create(self, serializer):
        report = serializer.save()
        task = report.task

        if task.status not in [Task.Status.COMPLETED, Task.Status.ON_REVIEW]:
            old_status = task.status
            transition_task_status(task, old_status, Task.Status.ON_REVIEW)