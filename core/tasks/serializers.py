from rest_framework import serializers
from .models import Task, TaskReport
from django.contrib.auth import get_user_model

User = get_user_model()

# --- Вспомогательный сериализатор для пользователя ---
class UserMiniSerializer(serializers.ModelSerializer):
    # Добавляем наше вычисляемое свойство стажа
    experience = serializers.ReadOnlyField() 
    
    class Meta:
        model = User
        # Отдаем только то, что нужно для отображения карточки исполнителя
        fields = ['id', 'first_name', 'last_name', 'email', 'role', 'experience']

# --- Сериализатор для отчетов ---
class TaskReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskReport
        fields = '__all__'

# --- Главный сериализатор для задач ---
class TaskSerializer(serializers.ModelSerializer):
    # Вместо ID пользователей отдаем красивые словари с их данными
    creator = UserMiniSerializer(read_only=True)
    assignee = UserMiniSerializer(read_only=True)

    assignee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='assignee',
        write_only=True,
        label='Исполнитель (ID)'
    )
    
    # Вложенные отчеты (чтобы при открытии задачи сразу видеть историю переписки/файлов)
    reports = TaskReportSerializer(many=True, read_only=True)
    
    # Выводим человекочитаемый статус ('В работе' вместо 'in_progress')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'parent_task', 
            'creator', 'assignee', 'assignee_id',
            'status', 'status_display', 
            'created_at', 'deadline', 'completed_at', 
            'revision_count', 'quality_score', 'reports'
        ]

        read_only_fields = ['status', 'created_at', 'completed_at', 'revision_count', 'quality_score']