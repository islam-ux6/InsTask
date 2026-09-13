from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .serializers import UserProfileSerializer

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    # Эндпоинт для "моего" профиля (уже был)
    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
        
    # ПЕРЕОПРЕДЕЛЯЕМ СТАНДАРТНЫЙ RETRIEVE (получение по ID)
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Проверяем права: 
        # 1. Если это сам пользователь - пускаем
        # 2. Если это ректор - пускаем ко всем
        # 3. Если завкафедрой - пускаем только к своим
        if request.user == instance or request.user.is_rectorate:
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
            
        if request.user.is_manager and request.user.department == instance.department:
             serializer = self.get_serializer(instance)
             return Response(serializer.data)
        
        # Если это обычный препод пытается посмотреть чужой профиль - отдаем только базовую инфу
        # (без записей о выговорах)
        serializer = self.get_serializer(instance)
        data = serializer.data
        data.pop('records', None) # Удаляем личные записи
        return Response(data)