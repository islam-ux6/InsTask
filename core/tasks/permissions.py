from rest_framework import permissions
from django.contrib.auth import get_user_model

User = get_user_model()

class IsTaskParticipant(permissions.BasePermission):
    """
    Правило: Пользователь может видеть и взаимодействовать с задачей только если он:
    1. Ректорат (видит всё)
    2. Постановщик этой задачи (creator)
    3. Исполнитель этой задачи (assignee)
    4. Завкафедры той же кафедры, что и постановщик или исполнитель.
    """
    
    def has_object_permission(self, request, view, obj):
        # 1. Если это ректорат — разрешаем всё
        if request.user.role == User.Role.RECTORATE:
            return True
            
        # 2. Если текущий пользователь — постановщик или исполнитель
        if obj.creator == request.user or obj.assignee == request.user:
            return True
            
        # 3. Если текущий пользователь — завкафедры (менеджер)
        if request.user.role == User.Role.MANAGER:
            # Разрешаем, если исполнитель или постановщик прикреплены к той же кафедре, которой руководит этот менеджер
            # (Проверяем через getattr, чтобы не упало, если department == None)
            user_dept_id = getattr(request.user.department, 'id', None)
            creator_dept_id = getattr(obj.creator.department, 'id', None)
            assignee_dept_id = getattr(obj.assignee.department, 'id', None)
            
            if user_dept_id and (user_dept_id == creator_dept_id or user_dept_id == assignee_dept_id):
                return True

        # В остальных случаях — запрет
        return False

class IsAssigneeForAccept(permissions.BasePermission):
    """
    Правило: Нажать "Взять в работу" может ТОЛЬКО исполнитель задачи.
    """
    def has_object_permission(self, request, view, obj):
        return obj.assignee == request.user