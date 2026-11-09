import django_filters
from django.db.models import Q

from .constants import Status
from .models import LandApplication


class ApplicationFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=Status.choices)
    received_from = django_filters.DateFilter(field_name="date_received", lookup_expr="gte")
    received_to = django_filters.DateFilter(field_name="date_received", lookup_expr="lte")
    category = django_filters.CharFilter(field_name="categories", lookup_expr="contains", method="filter_category")
    open = django_filters.BooleanFilter(method="filter_open")
    q = django_filters.CharFilter(method="filter_q")

    class Meta:
        model = LandApplication
        fields = [
            "status",
            "province",
            "preferred_province",
            "preferred_district",
            "farm_type",
            "farming_type",
            "sex",
            "source",
            "national_id",
            "assigned_to",
        ]

    def filter_category(self, queryset, name, value):
        return queryset.filter(categories__contains=[value])

    def filter_open(self, queryset, name, value):
        final = [Status.APPROVED, Status.REJECTED, Status.WITHDRAWN]
        return queryset.exclude(status__in=final) if value else queryset.filter(status__in=final)

    def filter_q(self, queryset, name, value):
        value = value.strip()
        if not value:
            return queryset
        query = Q()
        for term in value.split():
            query &= (
                Q(application_no__icontains=term)
                | Q(surname__icontains=term)
                | Q(other_names__icontains=term)
                | Q(national_id__icontains=term)
                | Q(preferred_district__icontains=term)
            )
        return queryset.filter(query)

