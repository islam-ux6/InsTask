from rest_framework import serializers
from .models import Task, TaskReport, TaskStatusLog
from accounts.models import User
from departments.models import Department

class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'position']

class DepartmentMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']

class TaskReportSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)
    class Meta:
        model = TaskReport
        # Используем правильные названия: comment, attached_file, submitted_at
        fields = ['id', 'task', 'author', 'comment', 'attached_file', 'submitted_at']
        read_only_fields = ['author']

class TaskStatusLogSerializer(serializers.ModelSerializer):
    hours_spent = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TaskStatusLog
        fields = ['id', 'status', 'status_display', 'entered_at', 'exited_at', 'hours_spent']

class TaskSerializer(serializers.ModelSerializer):
    creator = UserMiniSerializer(read_only=True)
    # Для чтения отдаем красивые объекты
    assignees = UserMiniSerializer(many=True, read_only=True)
    target_departments = DepartmentMiniSerializer(many=True, read_only=True)
    status_logs = TaskStatusLogSerializer(many=True, read_only=True)
    
    # ИСПРАВЛЕНИЕ: Переименовали ключи, чтобы они совпадали с фронтендом 
    # (убрали букву 's' перед '_ids')
    assignee_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source='assignees',
        write_only=True,
        many=True,
        required=False,
        label='Исполнители'
    )
    target_department_ids = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        source='target_departments',
        write_only=True,
        many=True,
        required=False,
        label='Целевые кафедры'
    )
    
    reports = TaskReportSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'parent_task', 
            'creator', 'assignees', 'assignee_ids',  # Обновили название здесь
            'target_departments', 'target_department_ids', # И здесь
            'status', 'status_display', 
            'created_at', 'deadline', 'completed_at', 
            'revision_count', 'quality_score', 'reports', 'status_logs'
        ]
        read_only_fields = ['created_at', 'completed_at', 'revision_count']

    def validate_status(self, value):
        request = self.context.get('request')
        if not self.instance:
            return 'created'
            
        if request and hasattr(request, 'user'):
            user = request.user
            old_status = self.instance.status
            
            # 1. Если это сам Постановщик задачи или Ректорат — разрешаем любые переходы
            is_creator = (self.instance.creator == user)
            if user.is_rectorate or is_creator:
                return value
                
            # 2. Если мы дошли сюда, значит пользователь — ИСПОЛНИТЕЛЬ 
            # (Преподаватель, или Завкафедрой, выполняющий задачу Ректора).
            # Оставляем им только права исполнителя:
            if old_status == 'created' and value == 'in_progress':
                return value
            if old_status in ['in_progress', 'revision'] and value == 'on_review':
                return value
                
            # Блокируем всё остальное
            raise serializers.ValidationError("Вы являетесь исполнителем этой задачи. Вы можете только брать её в работу или отправлять на проверку.")
            
        return value

    def validate_quality_score(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            is_creator = (self.instance.creator == user if self.instance else False)
            
            # Только постановщик или Ректорат могут ставить оценки
            if not user.is_rectorate and not is_creator:
                raise serializers.ValidationError("Только постановщик задачи может выставлять оценку качества.")
        return value