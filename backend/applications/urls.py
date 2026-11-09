from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ApplicationViewSet, MetaView, StatsView

router = DefaultRouter()
router.register("applications", ApplicationViewSet, basename="application")

urlpatterns = [
    path("meta/", MetaView.as_view(), name="meta"),
    path("stats/", StatsView.as_view(), name="stats"),
    path("", include(router.urls)),
]

