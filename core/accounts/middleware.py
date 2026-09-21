from django.utils import timezone
from datetime import datetime, time, timedelta
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import DailyAttendance

class TimeTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            try:
                auth_result = JWTAuthentication().authenticate(request)
                if auth_result:
                    user, token = auth_result
                    self.track_attendance(user)
            except Exception:
                pass 
        return self.get_response(request)

    def track_attendance(self, user):
        if getattr(user, 'work_status', 'working') != 'working':
            return

        # Получаем текущее локальное время и текущий часовой пояс
        now = timezone.localtime()
        current_timezone = timezone.get_current_timezone() # ИСПРАВЛЕНИЕ 1
        
        today = now.date()
        current_time = now.time()

        if not DailyAttendance.objects.filter(user=user, date=today).exists():
            try:
                start_str = user.working_hours.split('-')[0].strip()
                expected_hour, expected_minute = map(int, start_str.split(':'))
                
                # ИСПРАВЛЕНИЕ 2: Явно передаем текущий часовой пояс в make_aware!
                # Теперь Питон точно знает, что 09:00 - это 09:00 по Ашхабаду.
                naive_datetime = datetime.combine(today, time(expected_hour, expected_minute))
                expected_datetime = timezone.make_aware(naive_datetime, current_timezone)
                
                allowed_datetime = expected_datetime + timedelta(minutes=10)
                
                # Теперь сравнение двух aware-объектов с одинаковым поясом работает идеально
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