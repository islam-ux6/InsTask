from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from .serializers import UserProfileSerializer

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    # НОВЫЙ ЭНДПОИНТ: /api/users/me/
    @action(detail=False, methods=['get'])
    def me(self, request):
        # Передаем текущего пользователя (request.user) в сериализатор
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)