from django.utils import timezone
from datetime import datetime, time, timedelta
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
        # Если сотрудник не "Работает", игнорируем
        if getattr(user, 'work_status', 'working') != 'working':
            return

        now = timezone.localtime()
        today = now.date()
        current_time = now.time()

        if not DailyAttendance.objects.filter(user=user, date=today).exists():
            try:
                # Достаем время начала работы (например, "08:30")
                start_str = user.working_hours.split('-')[0].strip()
                expected_hour, expected_minute = map(int, start_str.split(':'))
                
                # Чтобы безопасно прибавить 10 минут, нам нужно превратить время в полноценный datetime
                expected_datetime = timezone.make_aware(
                    datetime.combine(today, time(expected_hour, expected_minute))
                )
                
                # ДОБАВЛЯЕМ 10 МИНУТ ПОБЛАЖКИ
                allowed_datetime = expected_datetime + timedelta(minutes=10)
                
                # Сравниваем текущее время с РАЗРЕШЕННЫМ временем (08:40)
                is_late = now > allowed_datetime
                status = DailyAttendance.Status.LATE if is_late else DailyAttendance.Status.ON_TIME

                DailyAttendance.objects.create(
                    user=user,
                    date=today,
                    arrival_time=current_time,
                    status=status
                )
            except Exception as e:
                print(f"Ошибка учета времени для {user.username}: {e}")