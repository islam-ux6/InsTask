from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    class TeachingStatus(models.TextChoices):
        LAB_ASSISTANT = 'lab_assistant', 'Лаборант'
        SENIOR_LAB = 'senior_lab', 'Старший лаборант'
        JUNIOR_TEACHER = 'junior_teacher', 'Младший преподаватель'
        TEACHER = 'teacher', 'Преподаватель'
        SENIOR_TEACHER = 'senior_teacher', 'Старший преподаватель'
        DOCENT = 'docent', 'Доцент'
        PROFESSOR = 'professor', 'Профессор'

    class AcademicDegree(models.TextChoices):
        NONE = 'none', 'Нет степени'
        CANDIDATE = 'candidate', 'Кандидат наук'
        DOCTOR = 'doctor', 'Доктор наук'

    class Position(models.TextChoices):
        NONE = 'none', 'Нет административной должности'
        HEAD_OF_DEPARTMENT = 'head_of_department', 'Завкафедрой'
        DEPUTY_DEAN = 'deputy_dean', 'Замдекана'
        DEAN = 'dean', 'Декан'
        PRORECTOR = 'prorector', 'Проректор'
        RECTOR = 'rector', 'Ректор'

    class WorkingHours(models.TextChoices):
        SHIFT_1 = '08:00-16:30', '8:00-16:30'
        SHIFT_2 = '08:00-15:00', '8:00-15:00'

    teaching_status = models.CharField(max_length=20, choices=TeachingStatus.choices, null=True, blank=True, verbose_name='Преподавательский статус')
    academic_degree = models.CharField(max_length=20, choices=AcademicDegree.choices, default=AcademicDegree.NONE, verbose_name='Ученая степень')
    position = models.CharField(max_length=20, choices=Position.choices, default=Position.NONE, verbose_name='Должность')
    working_hours = models.CharField(max_length=20, choices=WorkingHours.choices, default=WorkingHours.SHIFT_1, verbose_name='Рабочие часы')
    
    department = models.ForeignKey('departments.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='employees')
    phone = models.CharField(max_length=20, blank=True)
    employment_date = models.DateField(null=True, blank=True)

    @property
    def is_manager(self):
        return self.position in [self.Position.HEAD_OF_DEPARTMENT, self.Position.DEPUTY_DEAN, self.Position.DEAN]

    @property
    def is_rectorate(self):
        return self.position in [self.Position.PRORECTOR, self.Position.RECTOR]

# НОВАЯ МОДЕЛЬ: Личное дело (Дисциплина и Награды)
class EmployeeRecord(models.Model):
    class RecordType(models.TextChoices):
        REWARD = 'reward', 'Поощрение / Награда'
        REPRIMAND = 'reprimand', 'Выговор'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='records', verbose_name='Кому выдано')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='issued_records', verbose_name='Кто выдал')
    record_type = models.CharField(max_length=15, choices=RecordType.choices, verbose_name='Тип записи')
    description = models.TextField(verbose_name='Причина / Описание')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата выдачи')

    def __str__(self):
        return f"{self.get_record_type_display()} - {self.user.username}"

class DailyAttendance(models.Model):
    class Status(models.TextChoices):
        ON_TIME = 'on_time', 'Вовремя'
        LATE = 'late', 'Опоздал'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records', verbose_name='Сотрудник')
    date = models.DateField(auto_now_add=True, verbose_name='Дата')
    arrival_time = models.TimeField(auto_now_add=True, verbose_name='Время фиксации')
    status = models.CharField(max_length=10, choices=Status.choices, verbose_name='Статус')

    class Meta:
        # Запрещаем создавать больше одной записи для одного человека в день
        unique_together = ['user', 'date']
        verbose_name = 'Посещаемость'
        verbose_name_plural = 'Посещаемость'

    def __str__(self):
        return f"{self.user.username} - {self.date} ({self.get_status_display()})"