from django.contrib import admin
from .models import Task, TaskReport

class TaskReportInline(admin.TabularInline):
    model = TaskReport
    extra = 0

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    # Вместо assignee вызываем нашу функцию get_assignees
    list_display = ['title', 'status', 'creator', 'get_assignees', 'deadline', 'quality_score']
    
    # Обновили фильтры
    list_filter = ['status', 'creator', 'target_departments', 'deadline']
    search_fields = ['title', 'description']
    inlines = [TaskReportInline]
    
    # Магия Django: делает красивое окно выбора с двумя колонками для списков
    filter_horizontal = ('assignees', 'target_departments')

    def get_assignees(self, obj):
        # Собираем имена всех исполнителей через запятую
        names = [user.get_full_name() or user.username for user in obj.assignees.all()]
        return ", ".join(names)
    
    get_assignees.short_description = 'Исполнители'

@admin.register(TaskReport)
class TaskReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'task', 'author', 'submitted_at']
    list_filter = ['submitted_at', 'author']