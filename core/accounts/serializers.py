from rest_framework import serializers
from django.contrib.auth import get_user_model
from departments.serializers import DepartmentSerializer

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    # Вкладываем сериализатор кафедры, чтобы получить ее название, а не просто ID
    department = DepartmentSerializer(read_only=True)
    
    # Подключаем наше вычисляемое поле стажа
    experience = serializers.ReadOnlyField()
    
    # Человекочитаемая должность (например, "Завкафедры" вместо "manager")
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 
            'username', 
            'email', 
            'first_name', 
            'last_name', 
            'phone_number', 
            'birth_date', 
            'hire_date',
            'experience',
            'role', 
            'role_display', 
            'department'
        ]