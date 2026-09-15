from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Avg, F
from django.utils import timezone
from django.contrib.auth import get_user_model
from tasks.models import Task, TaskStatusLog  # <-- ВАЖНО: Добавили TaskStatusLog
from departments.models import Department
from accounts.models import DailyAttendance

User = get_user_model()

class DashboardAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.localdate()

        if user.is_rectorate:
            users_qs = User.objects.all()
            tasks_qs = Task.objects.all()
            scope = "institute"
        elif user.is_manager and user.department:
            users_qs = User.objects.filter(department=user.department)
            tasks_qs = Task.objects.filter(
                Q(target_departments=user.department) | Q(creator=user)
            ).distinct()
            scope = "department"
        else:
            return Response({"detail": "Нет прав"}, status=403)

        # --- Хелпер для подсчета времени (Бутылочные горлышки) ---
        def get_cycle_time(log_qs):
            logs = list(log_qs.filter(exited_at__isnull=False))
            def avg_hours(status_name):
                st_logs = [l for l in logs if l.status == status_name]
                return round(sum(l.hours_spent for l in st_logs) / len(st_logs), 1) if st_logs else 0
            
            return {
                "in_progress": avg_hours('in_progress'),
                "on_review": avg_hours('on_review'),
                "revision": avg_hours('revision'),
            }

        # --- 1. ОБЩИЕ KPI ---
        total_tasks = tasks_qs.count()
        completed_tasks = tasks_qs.filter(status=Task.Status.COMPLETED).count()
        completion_rate = round((completed_tasks / total_tasks) * 100) if total_tasks > 0 else 0
        avg_quality = tasks_qs.filter(status=Task.Status.COMPLETED).aggregate(Avg('quality_score'))['quality_score__avg'] or 0

        today_attendance = DailyAttendance.objects.filter(date=today, user__in=users_qs)
        on_time = today_attendance.filter(status=DailyAttendance.Status.ON_TIME).count()
        late = today_attendance.filter(status=DailyAttendance.Status.LATE).count()

        # --- 2. АНАЛИТИКА ПО КАФЕДРАМ ---
        departments_data = []
        if user.is_rectorate:
            for dept in Department.objects.all():
                d_tasks = Task.objects.filter(target_departments=dept)
                d_tot = d_tasks.count()
                d_comp = d_tasks.filter(status=Task.Status.COMPLETED).count()
                d_qual = d_tasks.filter(status=Task.Status.COMPLETED).aggregate(Avg('quality_score'))['quality_score__avg'] or 0
                
                # Считаем время для кафедры
                d_logs = TaskStatusLog.objects.filter(task__target_departments=dept)

                departments_data.append({
                    "id": dept.id,
                    "name": dept.name,
                    "total": d_tot,
                    "completed": d_comp,
                    "completion_rate": round((d_comp / d_tot) * 100) if d_tot > 0 else 0,
                    "quality": round(d_qual, 1),
                    "cycle_time": get_cycle_time(d_logs), # Интегрируем время!
                    "statuses": {
                        "created": d_tasks.filter(status=Task.Status.CREATED).count(),
                        "in_progress": d_tasks.filter(status=Task.Status.IN_PROGRESS).count(),
                        "on_review": d_tasks.filter(status=Task.Status.ON_REVIEW).count(),
                        "revision": d_tasks.filter(status=Task.Status.REVISION).count(),
                        "completed": d_comp
                    }
                })

        # --- 3. АНАЛИТИКА ПО СОТРУДНИКАМ ---
        employees_data = []
        max_tasks_in_qs = 1 
        for u in users_qs:
            c = Task.objects.filter(assignees=u).count()
            if c > max_tasks_in_qs: max_tasks_in_qs = c

        for emp in users_qs:
            e_tasks = Task.objects.filter(assignees=emp)
            e_comp_tasks = e_tasks.filter(status=Task.Status.COMPLETED)
            
            e_tot = e_tasks.count()
            e_comp = e_comp_tasks.count()
            
            e_qual_raw = e_comp_tasks.aggregate(Avg('quality_score'))['quality_score__avg'] or 0
            radar_quality = round((e_qual_raw / 5) * 100) if e_qual_raw else 0
            
            emp_att = DailyAttendance.objects.filter(user=emp, date__month=today.month)
            e_on_time = emp_att.filter(status=DailyAttendance.Status.ON_TIME).count()
            e_late = emp_att.filter(status=DailyAttendance.Status.LATE).count()
            radar_discipline = round((e_on_time / (e_on_time + e_late)) * 100) if (e_on_time + e_late) > 0 else 100
            
            no_revision_count = e_comp_tasks.filter(revision_count=0).count()
            radar_autonomy = round((no_revision_count / e_comp) * 100) if e_comp > 0 else 0
            
            on_time_tasks = e_comp_tasks.filter(completed_at__lte=F('deadline')).count()
            radar_speed = round((on_time_tasks / e_comp) * 100) if e_comp > 0 else 0
            
            radar_volume = round((e_tot / max_tasks_in_qs) * 100)

            # Считаем время для конкретного сотрудника
            e_logs = TaskStatusLog.objects.filter(task__assignees=emp)

            employees_data.append({
                "id": emp.id,
                "name": f"{emp.last_name} {emp.first_name[0] if emp.first_name else ''}.",
                "department_id": emp.department.id if emp.department else None,
                "total": e_tot,
                "completed": e_comp,
                "completion_rate": round((e_comp / e_tot) * 100) if e_tot > 0 else 0,
                "quality": round(e_qual_raw, 1),
                "discipline": radar_discipline,
                "cycle_time": get_cycle_time(e_logs), # Интегрируем время!
                "radar": {
                    "quality": radar_quality,
                    "discipline": radar_discipline,
                    "autonomy": radar_autonomy,
                    "speed": radar_speed,
                    "volume": radar_volume
                },
                "statuses": {
                    "created": e_tasks.filter(status=Task.Status.CREATED).count(),
                    "in_progress": e_tasks.filter(status=Task.Status.IN_PROGRESS).count(),
                    "on_review": e_tasks.filter(status=Task.Status.ON_REVIEW).count(),
                    "revision": e_tasks.filter(status=Task.Status.REVISION).count(),
                    "completed": e_comp
                }
            })
        
        employees_data.sort(key=lambda x: x['completion_rate'], reverse=True)

        return Response({
            "scope": scope,
            "kpi": {
                "total_staff": users_qs.count(),
                "on_time": on_time,
                "late": late,
                "completion_rate": completion_rate,
                "avg_quality": round(avg_quality, 1)
            },
            "departments": departments_data,
            "employees": employees_data
        })