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
        read_only_fields = ['task', 'author']

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
    
    # Для записи принимаем массивы ID (например: [1, 3, 5])
    assignees_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), 
        source='assignees',
        write_only=True,
        many=True,
        required=False,
        label='Исполнители'
    )
    target_departments_ids = serializers.PrimaryKeyRelatedField(
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
            'creator', 'assignees', 'assignees_ids', 
            'target_departments', 'target_departments_ids',
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
            # Если это не менеджер и не ректорат, значит это преподаватель
            if not user.is_manager and not user.is_rectorate:
                raise serializers.ValidationError("Преподаватели не могут менять статус вручную.")
        return value

    def validate_quality_score(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            if not user.is_manager and not user.is_rectorate:
                raise serializers.ValidationError("Преподаватели не могут выставлять оценки.")
        return value