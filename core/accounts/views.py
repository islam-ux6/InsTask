from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import IntegrityError
from .models import EmployeeRecord, DailyAttendance, ScheduleItem
from .serializers import UserProfileSerializer, EmployeeRecordSerializer, ScheduleItemSerializer

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

    @action(detail=False, methods=['post'], url_path='checkin')
    def checkin(self, request):
        now = timezone.localtime(timezone.now())
        today = now.date()

        existing = DailyAttendance.objects.filter(user=request.user, date=today).first()
        if existing:
            return Response(
                {'status': existing.status, 'created': False, 'detail': 'Отметка за сегодня уже существует.'},
                status=status.HTTP_200_OK
            )

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

    # НОВОЕ: Добавление и удаление пар с защитой от накладок аудиторий, преподавателей и групп
    @action(detail=True, methods=['post', 'delete'], url_path='schedule')
    def manage_schedule(self, request, pk=None):
        manager = request.user
        target_user = self.get_object()

        # Проверка прав: Ректорат, Деканат или Заведующий своей кафедрой
        can_manage = (
            manager.is_rectorate or
            manager.position in ['dean', 'deputy_dean'] or
            (manager.position == 'head_of_department' and manager.department == target_user.department)
        )
        if not can_manage:
            return Response(
                {'detail': 'У вас нет прав для редактирования расписания этого сотрудника.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.method == 'DELETE':
            item_id = request.query_params.get('item_id')
            if not item_id:
                return Response({'detail': 'Не указан ID занятия.'}, status=status.HTTP_400_BAD_REQUEST)
            deleted_count, _ = ScheduleItem.objects.filter(id=item_id, user=target_user).delete()
            if deleted_count == 0:
                return Response({'detail': 'Занятие не найдено.'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'status': 'deleted'}, status=status.HTTP_200_OK)

        # Метод POST — создание нового занятия с проверкой накладок
        serializer = ScheduleItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        week_type = data['week_type']
        day_of_week = data['day_of_week']
        time_slot = data['time_slot'].strip()
        room = data['room'].strip()
        group = data['group'].strip()

        # Определяем пересекающиеся типы недель ('both' пересекается и с 'odd', и с 'even')
        overlapping_weeks = ['odd', 'even', 'both'] if week_type == 'both' else [week_type, 'both']

        same_slot_qs = ScheduleItem.objects.select_related('user').filter(
            day_of_week=day_of_week,
            time_slot=time_slot,
            week_type__in=overlapping_weeks
        )

        # 1. Проверка накладки по аудитории
        room_conflict = same_slot_qs.filter(room__iexact=room).first()
        if room_conflict:
            teacher_name = f"{room_conflict.user.last_name} {room_conflict.user.first_name}".strip()
            return Response(
                {
                    'detail': f"Накладка аудитории: кабинет «{room}» в это время ({day_of_week}, {time_slot}) уже занят! Там ведет пару {teacher_name} (дисциплина: «{room_conflict.subject_name}», группа: {room_conflict.group})."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Проверка накладки у самого преподавателя
        teacher_conflict = same_slot_qs.filter(user=target_user).first()
        if teacher_conflict:
            return Response(
                {
                    'detail': f"Накладка преподавателя: у {target_user.last_name} {target_user.first_name} в это время ({day_of_week}, {time_slot}) уже стоит пара «{teacher_conflict.subject_name}» в ауд. {teacher_conflict.room}."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Проверка накладки у студенческой группы
        group_conflict = same_slot_qs.filter(group__iexact=group).first()
        if group_conflict:
            teacher_name = f"{group_conflict.user.last_name} {group_conflict.user.first_name}".strip()
            return Response(
                {
                    'detail': f"Накладка группы: у группы «{group}» в это время ({day_of_week}, {time_slot}) уже идет занятие «{group_conflict.subject_name}» (преп. {teacher_name}, ауд. {group_conflict.room})."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer.save(user=target_user, time_slot=time_slot, room=room, group=group)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        user = self.request.user
        target_user = self.get_object()

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