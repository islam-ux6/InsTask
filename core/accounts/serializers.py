from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import EmployeeRecord, DailyAttendance

User = get_user_model()

class EmployeeRecordSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    record_type_display = serializers.CharField(source='get_record_type_display', read_only=True)

    class Meta:
        model = EmployeeRecord
        fields = ['id', 'user', 'record_type', 'record_type_display', 'description', 'author_name', 'created_at']
        read_only_fields = ['author_name', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.username
        return "Система"


class UserProfileSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    teaching_status_display = serializers.CharField(source='get_teaching_status_display', read_only=True)
    academic_degree_display = serializers.CharField(source='get_academic_degree_display', read_only=True)
    position_display = serializers.CharField(source='get_position_display', read_only=True)
    work_status_display = serializers.CharField(source='get_work_status_display', read_only=True)
    records = EmployeeRecordSerializer(many=True, read_only=True)
    attendance_history = serializers.SerializerMethodField()
    schedule = serializers.SerializerMethodField()

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
            'attendance_history',
            'schedule'
        ]
        # ИСПРАВЛЕНО: Запрещаем пользователям менять себе должность, степень или кафедру через API
        read_only_fields = [
            'username', 'position', 'teaching_status', 'academic_degree',
            'department', 'employment_date', 'working_hours',
            'is_manager', 'is_rectorate'
        ]

    def get_attendance_history(self, obj):
        # ИСПРАВЛЕНО: Используем prefetched-кэш obj.attendance_records.all() вместо нового запроса к БД
        records = obj.attendance_records.all()
        return {str(record.date): record.status for record in records}

    def get_schedule(self, obj):
        days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
        schedule_data = {
            'odd': {day: [] for day in days},
            'even': {day: [] for day in days}
        }

        items = obj.schedule_items.all()

        for item in items:
            day_key = item.day_of_week
            if day_key not in schedule_data['odd']:
                continue

            entry = {
                'time': item.time_slot,
                'name': item.subject_name,
                'type': item.class_type,
                'room': item.room,
                'group': item.group
            }

            if item.week_type in ['odd', 'both']:
                schedule_data['odd'][day_key].append(entry)
            
            if item.week_type in ['even', 'both']:
                schedule_data['even'][day_key].append(entry)

        return schedule_data