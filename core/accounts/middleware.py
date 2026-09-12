from django.utils import timezone
from datetime import time
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import DailyAttendance

class TimeTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Отлавливаем только запросы к нашему API
        if request.path.startswith('/api/'):
            try:
                # Пытаемся авторизовать пользователя по JWT токену из заголовков
                auth_result = JWTAuthentication().authenticate(request)
                if auth_result:
                    user, token = auth_result
                    self.track_attendance(user)
            except Exception:
                # Если токен просрочен или его нет - просто пропускаем запрос дальше (DRF сам выдаст 401 ошибку)
                pass 

        return self.get_response(request)

    def track_attendance(self, user):
        # Получаем текущую локальную дату и время
        now = timezone.localtime()
        today = now.date()
        current_time = now.time()

        # Проверяем, есть ли уже запись за сегодня. Если нет - создаем!
        if not DailyAttendance.objects.filter(user=user, date=today).exists():
            
            # Достаем время начала работы из профиля (например из "08:00-16:30" берем "08:00")
            start_str = user.working_hours.split('-')[0]
            expected_hour, expected_minute = map(int, start_str.split(':'))
            expected_time = time(expected_hour, expected_minute)

            # Проверяем на опоздание
            is_late = current_time > expected_time
            status = DailyAttendance.Status.LATE if is_late else DailyAttendance.Status.ON_TIME

            # Записываем в базу
            DailyAttendance.objects.create(
                user=user,
                date=today,
                arrival_time=current_time,
                status=status
            )