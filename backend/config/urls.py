from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "Ministry of Lands and Rural Development"
admin.site.site_title = "Land Applications Registry"
admin.site.index_title = "Administration"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("applications.urls")),
]

