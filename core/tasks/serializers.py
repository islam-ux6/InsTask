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

        read_only_fields = ['created_at', 'completed_at', 'revision_count']

    def validate_assignee_id(self, value):
        """
        Проверяет, имеет ли право текущий пользователь назначить задачу выбранному исполнителю (value).
        value - это уже объект User, который DRF нашел по переданному ID.
        """
        # Получаем пользователя, который отправляет запрос
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return value # Защита от ошибок, если контекста нет
            
        current_user = request.user
        
        # 1. Ректорату можно всё (например, назначить задачу любому завкафедры)
        if current_user.role == current_user.Role.RECTORATE:
            return value
            
        # 2. Если назначает Завкафедры
        if current_user.role == current_user.Role.MANAGER:
            # Проверяем, что кафедра исполнителя совпадает с кафедрой завкафедры
            if value.department != current_user.department:
                raise serializers.ValidationError(
                    "Вы можете назначать задачи только сотрудникам своей кафедры."
                )
                
        # 3. Если назначает обычный Преподаватель (например, создает сам себе напоминание)
        if current_user.role == current_user.Role.TEACHER:
            if value != current_user:
                raise serializers.ValidationError(
                    "Преподаватель может назначать задачи только самому себе."
                )
                
        return value

    def validate_status(self, value):
        """Контролируем, кто и когда может менять статус"""
        request = self.context.get('request')
        
        # Если это создание новой задачи (self.instance пустой)
        if not self.instance:
            return 'created' # Жестко фиксируем статус "Создана", даже если в форме выбрали другой
            
        # Если это обновление существующей задачи
        if request and hasattr(request, 'user'):
            current_user = request.user
            # Преподаватель не может менять статус руками через PUT/PATCH 
            # (он делает это только через кнопку Accept или отправку отчета)
            if current_user.role == current_user.Role.TEACHER:
                raise serializers.ValidationError("Преподаватели не могут менять статус вручную.")
                
        return value

    def validate_quality_score(self, value):
        """Контролируем выставление оценок"""
        request = self.context.get('request')
        
        if request and hasattr(request, 'user'):
            # Оценку может ставить только менеджер или ректорат
            if request.user.role == request.user.Role.TEACHER:
                raise serializers.ValidationError("Преподаватели не могут выставлять оценки.")
                
        return value