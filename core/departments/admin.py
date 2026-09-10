from django.contrib import admin
from .models import Department

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    # Какие колонки выводить в общем списке
    list_display = ('name', 'head')
    # Добавляем строку поиска по названию кафедры
    search_fields = ('name',)