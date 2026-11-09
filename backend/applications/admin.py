from django.contrib import admin

from .models import Activity, Attachment, LandApplication, Review


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0
    readonly_fields = ("original_name", "content_type", "size", "uploaded_by", "uploaded_at")


class ReviewInline(admin.TabularInline):
    model = Review
    extra = 0
    readonly_fields = ("stage", "outcome", "decision_date", "recorded_by", "created_at")


@admin.register(LandApplication)
class LandApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "application_no", "surname", "other_names", "national_id", "province",
        "farm_type", "status", "date_received",
    )
    list_filter = ("status", "province", "preferred_province", "farm_type", "farming_type", "sex")
    search_fields = ("application_no", "surname", "other_names", "national_id")
    readonly_fields = ("reference", "application_no", "created_at", "updated_at", "decided_at")
    inlines = [AttachmentInline, ReviewInline]
    date_hierarchy = "date_received"


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("application", "verb", "actor", "created_at")
    list_filter = ("verb",)
    search_fields = ("application__application_no", "message")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

