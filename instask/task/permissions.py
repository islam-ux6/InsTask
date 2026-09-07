from rest_framework.permissions import BasePermission


class IsTaskAssigneeorCreator(BasePermission):
    """
    Доступ к задаче только у создателя и исполнителя
    """
    def has_object_permission(self, request, view, obj):
        user = request.user

        if obj.creator == user or obj.assignee == user:
            return True