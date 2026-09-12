from rest_framework import serializers
from django.contrib.auth import get_user_model
from departments.serializers import DepartmentSerializer # если есть такой сериализатор

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    # Для удобства фронтенда можно отдавать название кафедры (опционально)
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    # Получаем красивые названия (display) для выпадающих списков
    teaching_status_display = serializers.CharField(source='get_teaching_status_display', read_only=True)
    academic_degree_display = serializers.CharField(source='get_academic_degree_display', read_only=True)
    position_display = serializers.CharField(source='get_position_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 
            'username', 
            'email', 
            'first_name', 
            'last_name', 
            'phone',  # <-- Исправлено с phone_number на phone
            'teaching_status', 'teaching_status_display',
            'academic_degree', 'academic_degree_display',
            'position', 'position_display',
            'working_hours',
            'department', 'department_name',
            'employment_date',
            'is_manager', # наши property-поля
            'is_rectorate'
        ]
        read_only_fields = ['is_manager', 'is_rectorate']