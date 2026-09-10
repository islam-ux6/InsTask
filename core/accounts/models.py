from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import date


class User(AbstractUser):
    class Role(models.TextChoices):
        RECTORATE = 'rectorate', 'Ректорат'
        MANAGER = 'manager', 'Завкафедры'
        TEACHER = 'teacher', 'Преподаватель'

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.TEACHER,
        verbose_name='Роль'
    )

    email = models.EmailField(unique=True, verbose_name='Email')

    phone_number = models.CharField(max_length=20, blank=True, null=True, verbose_name='Номер телефона')
    birth_date = models.DateField(null=True, blank=True, verbose_name='Дата рождения')
    hire_date = models.DateField(null=True, blank=True, verbose_name='Дата начала работы')

    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
        verbose_name='Кафедра'
    )

    @property
    def experience(self):
        if self.hire_date:
            today = date.today()
            return today.year - self.hire_date.year - (
                (today.month, today.day) < (self.hire_date.month, self.hire_date.day)
            )
        return 0

    def __str__(self):
        name = self.get_full_name() or self.username
        return f"{name} ({self.get_role_display()})"