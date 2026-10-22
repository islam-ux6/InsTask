from rest_framework import serializers
from .models import Task, TaskReport, TaskStatusLog
from accounts.models import User
from departments.models import Department

class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'position', 'department']

class DepartmentMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']

class TaskReportSerializer(serializers.ModelSerializer):
    author = UserMiniSerializer(read_only=True)
    class Meta:
        model = TaskReport
        fields = ['id', 'task', 'author', 'comment', 'attached_file', 'submitted_at']
        read_only_fields = ['author']

class TaskStatusLogSerializer(serializers.ModelSerializer):
    hours_spent = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TaskStatusLog
        fields = ['id', 'status', 'status_display', 'entered_at', 'exited_at', 'hours_spent']

class SubtaskSerializer(serializers.ModelSerializer):
    assignees = UserMiniSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Task
        fields = ['id', 'title', 'status', 'status_display', 'deadline', 'assignees', 'quality_score']

class TaskSerializer(serializers.ModelSerializer):
    creator = UserMiniSerializer(read_only=True)
    assignees = UserMiniSerializer(many=True, read_only=True)
    target_departments = DepartmentMiniSerializer(many=True, read_only=True)
    status_logs = TaskStatusLogSerializer(many=True, read_only=True)
    subtasks = SubtaskSerializer(many=True, read_only=True)
    
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
            'id', 'title', 'description', 'parent_task', 'subtasks',
            'creator', 'assignees', 'assignee_ids',
            'target_departments', 'target_department_ids',
            'status', 'status_display', 
            'created_at', 'deadline', 'completed_at', 
            'revision_count', 'quality_score', 'reports', 'status_logs'
        ]
        read_only_fields = ['created_at', 'completed_at', 'revision_count']

    # ИСПРАВЛЕНО: Проверка субординации при назначении исполнителей
    def validate_assignee_ids(self, assignees):
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            return assignees

        user = request.user
        if user.is_rectorate:
            return assignees

        for target in assignees:
            # Нельзя ставить задачи Ректорату
            if target.is_rectorate:
                raise serializers.ValidationError("Вы не можете назначать задачи руководству ректората.")
            # Завкафедрой может назначать задачи только сотрудникам своей кафедры
            if user.position == 'head_of_department':
                if target.department != user.department or target.position in ['dean', 'deputy_dean']:
                    raise serializers.ValidationError("Заведующий кафедрой может назначать задачи только сотрудникам своей кафедры.")
        return assignees

    def validate_status(self, value):
        request = self.context.get('request')
        if not self.instance:
            return 'created'
            
        if request and hasattr(request, 'user'):
            user = request.user
            old_status = self.instance.status
            
            is_creator = (self.instance.creator == user)
            is_assignee = self.instance.assignees.filter(id=user.id).exists()
            is_in_target_dept = (
                user.department is not None and 
                self.instance.target_departments.filter(id=user.department.id).exists()
            )

            # 1. Запрещаем завершать задачу, если у неё есть незавершенные подзадачи
            if value == 'completed' and self.instance.subtasks.exclude(status='completed').exists():
                raise serializers.ValidationError("Нельзя завершить главную задачу, пока не выполнены все её подзадачи.")

            # 2. Постановщик задачи или Ректорат
            if user.is_rectorate or is_creator:
                return value
                
            # 3. Исполнитель (или сотрудник целевой кафедры)
            if is_assignee or is_in_target_dept:
                if old_status == 'created' and value == 'in_progress':
                    return value
                if old_status in ['in_progress', 'revision'] and value == 'on_review':
                    return value
                raise serializers.ValidationError("Вы являетесь исполнителем этой задачи. Вы можете только брать её в работу или отправлять на проверку.")

            raise serializers.ValidationError("У вас нет прав для изменения статуса чужой задачи.")
            
        return value

    def validate_quality_score(self, value):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            is_creator = (self.instance.creator == user if self.instance else False)
            
            if not user.is_rectorate and not is_creator:
                raise serializers.ValidationError("Только постановщик задачи может выставлять оценку качества.")
        return value