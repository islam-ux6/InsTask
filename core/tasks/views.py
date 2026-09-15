from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.utils import timezone

from .models import Task, TaskReport, TaskStatusLog
from .serializers import TaskSerializer, TaskReportSerializer
from .permissions import IsTaskParticipant, IsAssigneeForAccept 

class TaskViewSet(viewsets.ModelViewSet):
    """
    Основной API для работы с задачами (CRUD).
    Оптимизировано для работы с множественными исполнителями (assignees) 
    и целевыми кафедрами (target_departments).
    """
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskParticipant] 

    def get_queryset(self):
        user = self.request.user
        
        # ОПТИМИЗАЦИЯ: creator остался в select_related (ForeignKey)
        # assignees и target_departments ушли в prefetch_related (ManyToMany)
        base_qs = Task.objects.all().select_related('creator').prefetch_related(
            'assignees', 'target_departments', 'reports'
        )

        if user.is_rectorate or user.is_manager:
            return base_qs.distinct()

        # Обычный преподаватель
        return base_qs.filter(
            Q(assignees=user) | 
            Q(target_departments=user.department)
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status
        new_status = serializer.validated_data.get('status', old_status)

        if new_status != old_status:
            # 1. Останавливаем секундомер для старого статуса
            last_log = instance.status_logs.filter(status=old_status, exited_at__isnull=True).last()
            if last_log:
                last_log.exited_at = timezone.now()
                last_log.save()
            
            # 2. Запускаем секундомер для нового статуса
            TaskStatusLog.objects.create(task=instance, status=new_status)

            # Обновляем метрики для Радара (доработки и дедлайны)
            if new_status == 'revision':
                serializer.validated_data['revision_count'] = instance.revision_count + 1
            if new_status == 'completed':
                serializer.validated_data['completed_at'] = timezone.now()

        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAssigneeForAccept]) # Добавь IsAssigneeForAccept
    def accept(self, request, pk=None):
        """
        Кастомный эндпоинт для принятия задачи в работу.
        URL: /api/tasks/{id}/accept/
        """
        task = self.get_object()

        if task.status != Task.Status.CREATED:
            return Response(
                {"error": "Вы можете принять в работу только новые задачи (статус 'Создана')."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        task.status = Task.Status.IN_PROGRESS
        task.save(update_fields=['status'])
        
        serializer = self.get_serializer(task)
        return Response(serializer.data)


class TaskReportViewSet(viewsets.ModelViewSet):
    """API для отправки отчетов (решений) по задачам"""
    queryset = TaskReport.objects.all()
    serializer_class = TaskReportSerializer

    def perform_create(self, serializer):
        report = serializer.save()

        task = report.task

        if task.status not in [Task.Status.COMPLETED]:
            task.status = Task.Status.ON_REVIEW
            task.save(update_fields=['status'])