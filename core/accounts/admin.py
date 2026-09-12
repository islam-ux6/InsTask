from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, EmployeeRecord, DailyAttendance

class CustomUserAdmin(UserAdmin):
    model = User
    # Обновили колонки, которые выводятся в списке пользователей
    list_display = ['username', 'last_name', 'first_name', 'position', 'teaching_status', 'department', 'working_hours']
    
    # Обновили панель фильтров справа
    list_filter = ['position', 'teaching_status', 'academic_degree', 'department', 'working_hours', 'is_staff']
    
    # Добавили новые поля в форму редактирования пользователя
    fieldsets = UserAdmin.fieldsets + (
        ('Университетские данные', {
            'fields': (
                'position', 'teaching_status', 'academic_degree', 
                'department', 'working_hours', 'phone', 'employment_date'
            )
        }),
    )
    
    # Добавили новые поля в форму создания пользователя
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Университетские данные', {
            'fields': (
                'position', 'teaching_status', 'academic_degree', 
                'department', 'working_hours', 'phone', 'employment_date'
            )
        }),
    )

admin.site.register(User, CustomUserAdmin)

# Регистрируем Выговоры и Награды
@admin.register(EmployeeRecord)
class EmployeeRecordAdmin(admin.ModelAdmin):
    list_display = ['user', 'record_type', 'author', 'created_at']
    list_filter = ['record_type', 'created_at']
    search_fields = ['user__username', 'user__last_name', 'description']


@admin.register(DailyAttendance)
class DailyAttendanceAdmin(admin.ModelAdmin):
    # Настраиваем колонки в таблице
    list_display = ['user', 'get_department', 'date', 'arrival_time', 'status']
    
    # Фильтры сбоку: можно быстро отфильтровать всех опоздавших за сегодня
    list_filter = ['status', 'date', 'user__department']
    
    # Поиск по имени и фамилии
    search_fields = ['user__username', 'user__last_name', 'user__first_name']
    
    # Запрещаем редактировать дату создания и время (они должны быть честными)
    readonly_fields = ['date', 'arrival_time']

    # Кастомная функция, чтобы выводить название кафедры прямо в таблице посещаемости
    def get_department(self, obj):
        if obj.user.department:
            return obj.user.department.name
        return "—"
    get_department.short_description = 'Кафедра'
    
    # Сортировка по умолчанию: сначала самые свежие записи
    ordering = ['-date', '-arrival_time']