from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Task(models.Model):
    class Status(models.TextChoices):
        CREATED = 'created', 'Создана'
        IN_PROGRESS = 'in_progress', 'В работе'
        ON_REVIEW = 'on_review', 'На проверке'
        COMPLETED = 'completed', 'Выполнена'
        REVISION = 'revision', 'На доработке'

    title = models.CharField(max_length=255, verbose_name='Название задачи')
    description = models.TextField(verbose_name='Описание')

    parent_task = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subtasks',
        verbose_name='Главная задача'
    )

    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_tasks', verbose_name='Постановщик')
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='assigned_tasks',
        blank=True,
        verbose_name='Исполнители (Преподаватели)'
    )

    target_departments = models.ManyToManyField(
        'departments.Department',
        related_name='department_tasks',
        blank=True,
        verbose_name='Целевые кафедры (Общее задание)'
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED, verbose_name='Статус')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    deadline = models.DateTimeField(verbose_name='Дедлайн')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Фактическое время завершения')

    revision_count = models.IntegerField(default=0, verbose_name='Количество доработок')

    quality_score = models.PositiveSmallIntegerField(
        null=True, 
        blank=True, 
        verbose_name='Оценка качества (1-5)',
        validators=[
            MinValueValidator(1, message='Минимальная оценка — 1'),
            MaxValueValidator(5, message='Максимальная оценка — 5')
        ]
    )

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"


class TaskReport(models.Model):
    """Модель для отправки отчета о выполнении задачи"""
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='reports', verbose_name='Задача')
    # НОВОЕ ПОЛЕ: Кто именно из преподавателей отправил отчет
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submitted_reports', verbose_name='Автор отчета', null=True)
    
    comment = models.TextField(verbose_name='Комментарий исполнителя')
    attached_file = models.FileField(upload_to='task_reports/', null=True, blank=True, verbose_name='Прикрепленный файл')
    submitted_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата отправки')

    def __str__(self):
        return f"Отчет по задаче: {self.task.title}"