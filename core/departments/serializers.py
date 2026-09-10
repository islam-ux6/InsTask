from rest_framework import serializers
from .models import Department

class DepartmentSerializer(serializers.ModelSerializer):
    # Пока оставляем head как ID пользователя, чтобы избежать циклических импортов.
    # Фронтенду этого часто достаточно для маршрутизации.
    
    class Meta:
        model = Department
        fields = ['id', 'name', 'head']