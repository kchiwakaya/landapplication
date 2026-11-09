from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path

admin.site.site_header = "Ministry of Lands and Rural Development"
admin.site.site_title = "Land Applications Registry"
admin.site.index_title = "Administration"


def healthz(_request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", healthz, name="health"),
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("applications.urls")),
]


