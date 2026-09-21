from rest_framework import viewsets, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import EmployeeRecord
from .serializers import UserProfileSerializer, EmployeeRecordSerializer

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    # --- НОВОЕ: Оптимизируем запросы, чтобы расписание и записи грузились мгновенно ---
    def get_queryset(self):
        return User.objects.all().select_related('department').prefetch_related(
            'records', 'records__author', 'schedule_items' 
        )

    @action(detail=False, methods=['get'])
    def me(self, request):
        # ИСПРАВЛЕНИЕ: Берем пользователя через нашу оптимизированную выборку,
        # а не просто request.user, иначе расписание вызовет N+1 проблему базы данных
        instance = self.get_queryset().get(id=request.user.id)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
        
    def retrieve(self, request, *args, **kwargs):
        # get_object() автоматически использует наш get_queryset() выше
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
        serializer = self.get_serializer(instance)
        data = serializer.data
        data.pop('records', None) # Удаляем личные записи
        return Response(data)


class EmployeeRecordViewSet(viewsets.ModelViewSet):
    queryset = EmployeeRecord.objects.all()
    serializer_class = EmployeeRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        # Проверяем права: только начальники могут выдавать записи
        if not user.is_manager and not user.is_rectorate:
            raise serializers.ValidationError("Только руководство может выдавать достижения и выговоры.")
        
        # Сохраняем, жестко привязывая автора записи к текущему начальнику
        serializer.save(author=user)