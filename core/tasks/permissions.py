from rest_framework import permissions

class IsTaskParticipant(permissions.BasePermission):
    """
    Правило: Пользователь может видеть и взаимодействовать с задачей только если он:
    1. Ректорат (видит и редактирует всё).
    2. Завкафедрой (видит всё, но РЕДАКТИРУЕТ только задачи своей кафедры).
    3. Постановщик этой задачи (creator).
    4. Есть в списке исполнителей (assignees).
    5. Задача адресована целиком на его кафедру (target_departments).
    """
    
    def has_object_permission(self, request, view, obj):
        user = request.user

        # 1. Если это ректорат — разрешаем всё (и чтение, и изменение)
        if user.is_rectorate:
            return True
            
        # 2. НОВОЕ: Завкафедрой может ЧИТАТЬ (смотреть детали) любые задачи института.
        # Это нужно, чтобы он мог просматривать профили преподавателей других кафедр.
        if user.is_manager and request.method in permissions.SAFE_METHODS:
            return True
            
        # 3. Если текущий пользователь — постановщик
        if obj.creator == user:
            return True
            
        # 4. Если пользователь лично указан в списке исполнителей
        if obj.assignees.filter(id=user.id).exists():
            return True
            
        # 5. Если задача отправлена на кафедру пользователя
        if user.department and obj.target_departments.filter(id=user.department.id).exists():
            return True
            
        # 6. ПРАВА НА РЕДАКТИРОВАНИЕ для Завкафедры
        # Если он пытается изменить задачу, проверяем, относится ли она к его кафедре
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