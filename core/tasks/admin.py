from django.contrib import admin
from .models import Task, TaskReport

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    # Выводим самую важную информацию в виде таблицы
    list_display = ('title', 'status', 'creator', 'assignee', 'deadline', 'created_at')
    # Боковая панель с фильтрами (очень удобно искать просроченные или конкретного автора)
    list_filter = ('status', 'creator', 'assignee')
    # Поиск по тексту задачи
    search_fields = ('title', 'description')
    # Делаем поля доступными только для чтения (опционально, если хотим защитить метрики от ручного изменения)
    readonly_fields = ('created_at', 'completed_at', 'revision_count')

@admin.register(TaskReport)
class TaskReportAdmin(admin.ModelAdmin):
    list_display = ('task', 'submitted_at')