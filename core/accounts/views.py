from rest_framework import viewsets
from django.contrib.auth import get_user_model
from .serializers import UserProfileSerializer

User = get_user_model()

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet для просмотра пользователей.
    ReadOnlyModelViewSet разрешает только GET запросы (список и конкретный юзер).
    Создавать юзеров пока будем через админку или отдельный эндпоинт регистрации.
    """
    queryset = User.objects.all().select_related('department') # select_related предотвращает проблему N+1 запросов
    serializer_class = UserProfileSerializer