from rest_framework import viewsets, status
from rest_framework.decorators import action 
from rest_framework.response import Response 
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Task, TaskReport
from .serializers import TaskSerializer, TaskReportSerializer
from .permissions import IsTaskParticipant, IsAssigneeForAccept
from django.db.models import Q


class TaskViewSet(viewsets.ModelViewSet):
    """
    Основной API для работы с задачами (CRUD).
    prefetch_related загрузит все отчеты одним SQL-запросом, а не по одному на каждую задачу.
    """
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated, IsTaskParticipant]

    def get_queryset(self):
        user = self.request.user
        base_qs = Task.objects.all().select_related('creator', 'assignee').prefetch_related('reports')

        if user.role == user.Role.RECTORATE:
            return base_qs

        if user.role == user.Role.MANAGER and user.department:
            return base_qs.filter(
                Q(creator__department=user.department | Q(assignee__department=user.department))
            )

        return base_qs.filter(Q(creator=user) | Q(assignee=user))

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        old_status = instance.status

        updated_task = serializer.save()

        if old_status != Task.Status.REVISION and updated_task.status == Task.Status.REVISION:
            updated_task.revision_count += 1
            updated_task.save(update_fields=['revision_count'])

        if old_status != Task.Status.COMPLETED and updated_task.status == Task.Status.COMPLETED:
            updated_task.completed_at = timezone.now()
            updated_task.save(update_fields=['completed_at'])

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAssigneeForAccept])
    def accept(self, request, pk=None):
        """
        Кастомный эндпоинт для принятия задачи в работу.
        URL: /api/tasks/{id}/accept/
        """
        # Получаем текущую задачу по ID (pk)
        task = self.get_object()

        # Проверяем, что задача действительно находится в статусе "Создана"
        if task.status != Task.Status.CREATED:
            return Response(
                {"error": "Вы можете принять в работу только новые задачи (статус 'Создана')."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Меняем статус и сохраняем
        task.status = Task.Status.IN_PROGRESS
        task.save(update_fields=['status'])
        
        # Возвращаем обновленные данные задачи
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