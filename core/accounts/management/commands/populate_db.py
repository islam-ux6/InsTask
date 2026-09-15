import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from departments.models import Department
from tasks.models import Task, TaskStatusLog  # <-- Добавили TaskStatusLog
from accounts.models import DailyAttendance

User = get_user_model()

class Command(BaseCommand):
    help = 'Генерирует пользователей, задачи и исторические логи времени для проверки графиков задержек'

    def handle(self, *args, **kwargs):
        self.stdout.write('Начинаем генерацию данных (с логами времени)...')
        password = 'password123'

        # --- 1. КАФЕДРЫ ---
        dept_it, _ = Department.objects.get_or_create(name='Кафедра Информационных Технологий')
        dept_math, _ = Department.objects.get_or_create(name='Кафедра Высшей Математики')

        # --- 2. РУКОВОДСТВО ---
        rector, _ = User.objects.get_or_create(username='rector', defaults={
            'first_name': 'Иван', 'last_name': 'Ректоров',
            'position': User.Position.RECTOR, 'work_status': User.WorkStatus.WORKING
        })
        rector.set_password(password)
        rector.save()

        zav_it, _ = User.objects.get_or_create(username='zav_it', defaults={
            'first_name': 'Петр', 'last_name': 'Программистов',
            'position': User.Position.HEAD_OF_DEPARTMENT, 'department': dept_it,
            'work_status': User.WorkStatus.WORKING
        })
        zav_it.set_password(password)
        zav_it.save()

        zav_math, _ = User.objects.get_or_create(username='zav_math', defaults={
            'first_name': 'Анна', 'last_name': 'Пифагорова',
            'position': User.Position.HEAD_OF_DEPARTMENT, 'department': dept_math,
            'work_status': User.WorkStatus.WORKING
        })
        zav_math.set_password(password)
        zav_math.save()

        dept_it.head = zav_it; dept_it.save()
        dept_math.head = zav_math; dept_math.save()
        zavs = [zav_it, zav_math]

        # --- 3. ПРЕПОДАВАТЕЛИ ---
        teachers_data = [
            ('teach_it_1', 'Алексей', 'Кодеров', dept_it),
            ('teach_it_2', 'Мария', 'Базова', dept_it),
            ('teach_it_3', 'Игорь', 'Сетевой', dept_it),
            ('teach_math_1', 'Сергей', 'Интегралов', dept_math),
            ('teach_math_2', 'Ольга', 'Матричная', dept_math),
            ('teach_math_3', 'Дмитрий', 'Векторов', dept_math),
        ]
        teachers = []
        for username, first, last, dept in teachers_data:
            t, _ = User.objects.get_or_create(username=username, defaults={
                'first_name': first, 'last_name': last, 'position': User.Position.NONE,
                'teaching_status': User.TeachingStatus.TEACHER, 'department': dept,
                'work_status': User.WorkStatus.WORKING
            })
            t.set_password(password)
            t.save()
            teachers.append(t)

        # --- 4. ПОСЕЩАЕМОСТЬ ---
        today = timezone.localdate()
        for u in [rector] + zavs + teachers:
            status = DailyAttendance.Status.ON_TIME if random.random() > 0.2 else DailyAttendance.Status.LATE
            if not DailyAttendance.objects.filter(user=u, date=today).exists():
                DailyAttendance.objects.create(user=u, status=status)

        # --- 5. ОЧИЩАЕМ СТАРЫЕ ЗАДАЧИ ---
        self.stdout.write('Удаляем старые задачи для чистоты эксперимента...')
        Task.objects.all().delete()
        TaskStatusLog.objects.all().delete()

        # --- 6. МАШИНА ВРЕМЕНИ ДЛЯ ЗАДАЧ ---
        self.stdout.write('Генерируем новые задачи и историю их перемещений...')
        statuses = [
            Task.Status.COMPLETED, Task.Status.COMPLETED, Task.Status.COMPLETED,
            Task.Status.IN_PROGRESS, Task.Status.ON_REVIEW, Task.Status.REVISION
        ]

        for i in range(40): # Сделаем 40 задач для наглядности
            creator = random.choice([rector] + zavs)
            status = random.choice(statuses)
            
            # Задача была создана от 7 до 20 дней назад
            days_ago = random.randint(7, 20)
            t_created = timezone.now() - timedelta(days=days_ago)

            task = Task.objects.create(
                title=f'Аналитика времени #{i+1}',
                description='Генерация задержек',
                creator=creator,
                status=status,
                deadline=t_created + timedelta(days=14)
            )

            if creator.is_rectorate:
                task.target_departments.add(random.choice([dept_it, dept_math]))
            else:
                dept_teachers = [t for t in teachers if t.department == creator.department]
                if dept_teachers:
                    task.assignees.add(random.choice(dept_teachers))

            # --- Функция для записи фейковых логов времени ---
            def create_log(stat, entered, exited):
                log = TaskStatusLog.objects.create(task=task, status=stat)
                # Используем update, чтобы обойти auto_now_add
                TaskStatusLog.objects.filter(id=log.id).update(entered_at=entered, exited_at=exited)

            # Шаг 1: Создана (висит от 2 до 24 часов)
            t_in_progress = t_created + timedelta(hours=random.randint(2, 24))

            if status == Task.Status.CREATED:
                create_log(Task.Status.CREATED, t_created, None)

            elif status == Task.Status.IN_PROGRESS:
                create_log(Task.Status.CREATED, t_created, t_in_progress)
                create_log(Task.Status.IN_PROGRESS, t_in_progress, None)

            elif status == Task.Status.ON_REVIEW:
                t_on_review = t_in_progress + timedelta(hours=random.randint(24, 96)) # В работе от 1 до 4 дней
                create_log(Task.Status.CREATED, t_created, t_in_progress)
                create_log(Task.Status.IN_PROGRESS, t_in_progress, t_on_review)
                create_log(Task.Status.ON_REVIEW, t_on_review, None)

            elif status == Task.Status.REVISION:
                t_on_review = t_in_progress + timedelta(hours=random.randint(24, 72))
                t_revision = t_on_review + timedelta(hours=random.randint(12, 48)) # На проверке 1-2 дня
                create_log(Task.Status.CREATED, t_created, t_in_progress)
                create_log(Task.Status.IN_PROGRESS, t_in_progress, t_on_review)
                create_log(Task.Status.ON_REVIEW, t_on_review, t_revision)
                create_log(Task.Status.REVISION, t_revision, None)
                task.revision_count = 1
                task.save()

            elif status == Task.Status.COMPLETED:
                t_on_review = t_in_progress + timedelta(hours=random.randint(10, 80))
                t_completed = t_on_review + timedelta(hours=random.randint(5, 40))
                create_log(Task.Status.CREATED, t_created, t_in_progress)
                create_log(Task.Status.IN_PROGRESS, t_in_progress, t_on_review)
                create_log(Task.Status.ON_REVIEW, t_on_review, t_completed)
                create_log(Task.Status.COMPLETED, t_completed, None)

                task.quality_score = random.randint(3, 5)
                task.completed_at = t_completed
                task.save()

        self.stdout.write(self.style.SUCCESS('Готово! База загружена, логи времени (часы) сгенерированы.'))