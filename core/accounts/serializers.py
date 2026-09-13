from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import EmployeeRecord, DailyAttendance

User = get_user_model()

# 1. Новый сериализатор для личного дела
class EmployeeRecordSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    record_type_display = serializers.CharField(source='get_record_type_display', read_only=True)

    class Meta:
        model = EmployeeRecord
        fields = ['id', 'record_type', 'record_type_display', 'description', 'author_name', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.username
        return "Система"

# 2. Обновленный сериализатор профиля
class UserProfileSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    teaching_status_display = serializers.CharField(source='get_teaching_status_display', read_only=True)
    academic_degree_display = serializers.CharField(source='get_academic_degree_display', read_only=True)
    position_display = serializers.CharField(source='get_position_display', read_only=True)
    work_status_display = serializers.CharField(source='get_work_status_display', read_only=True)
    records = EmployeeRecordSerializer(many=True, read_only=True)
    attendance_history = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'phone',
            'teaching_status', 'teaching_status_display',
            'academic_degree', 'academic_degree_display',
            'position', 'position_display',
            'working_hours',
            'department', 'department_name',
            'employment_date',
            'is_manager', 'is_rectorate',
            'records',
            'work_status', 'work_status_display',
            'attendance_history'
        ]
        read_only_fields = ['is_manager', 'is_rectorate']

    def get_attendance_history(self, obj):
        # Собираем все записи посещаемости этого пользователя
        records = DailyAttendance.objects.filter(user=obj)
        # Возвращаем в виде удобного словаря: {'2023-10-25': 'on_time', ...}
        return {str(record.date): record.status for record in records}