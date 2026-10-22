from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import IntegrityError
from .models import EmployeeRecord, DailyAttendance
from .serializers import UserProfileSerializer, EmployeeRecordSerializer

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return User.objects.all().select_related('department').prefetch_related(
            'records', 'records__author', 'schedule_items', 'attendance_records'
        )

    @action(detail=False, methods=['get'])
    def me(self, request):
        instance = self.get_queryset().get(id=request.user.id)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    # НОВОЕ: Отметка явки на работу (Кнопка "Отметиться на работе" в профиле)
    @action(detail=False, methods=['post'], url_path='checkin')
    def checkin(self, request):
        now = timezone.localtime(timezone.now())
        today = now.date()

        # Проверяем, не отмечался ли сотрудник уже сегодня
        existing = DailyAttendance.objects.filter(user=request.user, date=today).first()
        if existing:
            return Response(
                {'status': existing.status, 'created': False, 'detail': 'Отметка за сегодня уже существует.'},
                status=status.HTTP_200_OK
            )

        # Если отметился после 08:30 — фиксируем опоздание
        is_late = (now.hour > 8) or (now.hour == 8 and now.minute > 30)
        status_val = 'late' if is_late else 'on_time'

        try:
            record = DailyAttendance.objects.create(
                user=request.user,
                date=today,
                arrival_time=now.time(),
                status=status_val
            )
            return Response({'status': record.status, 'created': True}, status=status.HTTP_201_CREATED)
        except IntegrityError:
            return Response({'status': status_val, 'created': False}, status=status.HTTP_200_OK)

    # НОВОЕ: Проверка прав при изменении рабочего статуса сотрудника (Работает / В отпуске / На больничном)
    def perform_update(self, serializer):
        user = self.request.user
        target_user = self.get_object()

        # Менять статус может сам сотрудник, его руководитель кафедры/декан или ректорат
        can_edit = (
            user == target_user or 
            user.is_rectorate or 
            (user.is_manager and user.department == target_user.department)
        )
        if not can_edit:
            raise serializers.ValidationError("У вас нет прав для изменения данных этого сотрудника.")
            
        serializer.save()
        
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        if request.user == instance or request.user.is_rectorate:
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
            
        if request.user.is_manager and request.user.department == instance.department:
            serializer = self.get_serializer(instance)
            return Response(serializer.data)
        
        serializer = self.get_serializer(instance)
        data = serializer.data
        data.pop('records', None)
        return Response(data)


class EmployeeRecordViewSet(viewsets.ModelViewSet):
    queryset = EmployeeRecord.objects.all()
    serializer_class = EmployeeRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        target_user = serializer.validated_data.get('user')

        if not user.is_manager and not user.is_rectorate:
            raise serializers.ValidationError("Только руководство может выдавать достижения и выговоры.")
        
        if user == target_user:
            raise serializers.ValidationError("Нельзя выдать запись самому себе.")

        if target_user.is_rectorate and not user.is_rectorate:
            raise serializers.ValidationError("Вы не можете выдавать записи руководству ректората.")

        if user.position == 'head_of_department' and target_user.department != user.department:
            raise serializers.ValidationError("Заведующий кафедрой может выдавать записи только сотрудникам своей кафедры.")

        serializer.save(author=user)