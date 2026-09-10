from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Дополнительная информация', {
            'fields': ('role', 'department', 'phone_number', 'birth_date', 'hire_date')
        }),
    )

    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'department')
    list_filter = ('role', 'department')