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
        fields = ['id', 'user', 'record_type', 'record_type_display', 'description', 'author_name', 'created_at']

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
        read_only_fields = ['is_manager', 'is_rectorate']

    def get_attendance_history(self, obj):
        records = DailyAttendance.objects.filter(user=obj)
        return {str(record.date): record.status for record in records}

    def get_schedule(self, obj):
        # 1. Создаем пустой шаблон (точно такой, как ждет React)
        days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
        schedule_data = {
            'odd': {day: [] for day in days},
            'even': {day: [] for day in days}
        }

        # 2. Получаем все пары преподавателя из базы
        # (Используем prefetch_related во views, чтобы избежать N+1 проблемы)
        items = obj.schedule_items.all()

        # 3. Раскладываем пары по полочкам
        for item in items:
            entry = {
                'time': item.time_slot,
                'name': item.subject_name,
                'type': item.class_type,
                'room': item.room,
                'group': item.group
            }

            # Если пара проходит каждую неделю - добавляем в обе ветки
            if item.week_type in ['odd', 'both']:
                schedule_data['odd'][item.day_of_week].append(entry)
            
            if item.week_type in ['even', 'both']:
                schedule_data['even'][item.day_of_week].append(entry)

        return schedule_data