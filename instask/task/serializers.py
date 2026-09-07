from rest_framework import serializers
from .models import Task
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email"]


class TaskSerializer(serializers.ModelSerializer):
    creator = UserSerializer(read_only=True)
    assignee = UserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='assignee', write_only=True, required=False
    )
    priority_display = serializers.CharField(source='get_priority_display')
    status_display = serializers.CharField(source='get_status_display')

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description',
            'assignee', 'assignee_id', 'creator', 'priority', 'priority_display',
            'status', 'status_display', 'due_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['creator', 'created_at', 'updated_at']