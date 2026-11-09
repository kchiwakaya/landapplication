from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "get_full_name", "email", "role", "province", "is_active")
    list_filter = ("role", "province", "is_active", "is_staff")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Ministry", {"fields": ("role", "province", "employee_number", "phone")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Ministry", {"fields": ("email", "first_name", "last_name", "role", "province")}),
    )

