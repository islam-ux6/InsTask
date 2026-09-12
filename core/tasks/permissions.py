from rest_framework import permissions

class IsTaskParticipant(permissions.BasePermission):
    """
    Правило: Пользователь может видеть и взаимодействовать с задачей только если он:
    1. Ректорат (видит всё).
    2. Постановщик этой задачи (creator).
    3. Есть в списке исполнителей (assignees).
    4. Задача адресована целиком на его кафедру (target_departments).
    5. Завкафедры той же кафедры, что и постановщик или хотя бы один из исполнителей.
    """
    
    def has_object_permission(self, request, view, obj):
        user = request.user

        # 1. Если это ректорат — разрешаем всё
        if user.is_rectorate:
            return True
            
        # 2. Если текущий пользователь — постановщик
        if obj.creator == user:
            return True
            
        # 3. Если пользователь лично указан в списке исполнителей
        if obj.assignees.filter(id=user.id).exists():
            return True
            
        # 4. Если задача отправлена на кафедру пользователя
        if user.department and obj.target_departments.filter(id=user.department.id).exists():
            return True
            
        # 5. Если текущий пользователь — завкафедры (менеджер)
        if user.is_manager and user.department:
            # С его ли кафедры создатель?
            if obj.creator and obj.creator.department == user.department:
                return True
            # Есть ли среди исполнителей сотрудники его кафедры?
            if obj.assignees.filter(department=user.department).exists():
                return True

        # В остальных случаях — запрет
        return False


class IsAssigneeForAccept(permissions.BasePermission):
    """
    Правило: Нажать "Взять в работу" может ТОЛЬКО:
    - Конкретно указанный исполнитель задачи.
    - Сотрудник кафедры, которой была адресована общая задача.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        
        # Разрешаем, если он есть в списке assignees
        if obj.assignees.filter(id=user.id).exists():
            return True
            
        # Разрешаем, если задача адресована его кафедре (всем сотрудникам)
        if user.department and obj.target_departments.filter(id=user.department.id).exists():
            return True
            
        return False