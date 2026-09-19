from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from .models import Task, TaskReport, TaskStatusLog
from .serializers import TaskSerializer, TaskReportSerializer
from .permissions import IsTaskParticipant, IsAssigneeForAccept 


# --- БЕЗОПАСНАЯ И БРОНЕБОЙНАЯ ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ---
def transition_task_status(task, old_status, new_status):
    if task.status == new_status:
        return

    # ИДЕМПОТЕНТНОСТЬ: Если последний лог уже с нужным статусом, игнорируем дубли
    last_log = task.status_logs.order_by('-entered_at').first()
    if last_log and last_log.status == new_status:
        return

    # УБИЙЦА КЛОНОВ: Закрываем ВООБЩЕ ВСЕ открытые секундомеры у этой задачи!
    task.status_logs.filter(exited_at__isnull=True).update(exited_at=timezone.now())

    # Обновляем саму задачу
    task.status = new_status
    if new_status == Task.Status.REVISION:
        task.revision_count += 1
    if new_status == Task.Status.COMPLETED:
        task.completed_at = timezone.now()
    
    task.save()

    # Запускаем один чистый секундомер
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
    queryset = TaskReport.objects.all()
    serializer_class = TaskReportSerializer

    def perform_create(self, serializer):
        report = serializer.save(author=self.request.user)
        task = report.task

        if task.status not in [Task.Status.COMPLETED, Task.Status.ON_REVIEW]:
            old_status = task.status
            transition_task_status(task, old_status, Task.Status.ON_REVIEW)