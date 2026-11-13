import csv
from datetime import timedelta

from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncMonth
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role

from . import workflow
from .constants import (
    DISTRICTS,
    FARM_SIZE_SCHEDULE,
    FINAL_STATUSES,
    OUTCOME_LABELS,
    PERI_URBAN_SIZE,
    REQUIRED_ATTACHMENTS,
    ApplicantCategory,
    AttachmentType,
    FarmingType,
    FarmType,
    MaritalStatus,
    NaturalRegion,
    Province,
    Sex,
    Source,
    Stage,
    Status,
    Title,
)
from .filters import ApplicationFilter
from .models import Activity, ApplicantNotification, Attachment, LandApplication
from .notifications import notify_farmer, notify_farmer_async
from .serializers import (
    ActivitySerializer,
    ApplicantNotificationSerializer,
    ApplicationDetailSerializer,
    ApplicationListSerializer,
    AttachmentSerializer,
    DecisionSerializer,
    ReviewSerializer,
    SmsGatewayDispatchSerializer,
)
from .sms_gateway import dispatch_sms_async, send_sms_via_android_gateway

ROLE_QUEUE = {rule.role: rule.from_status for rule in workflow.STAGE_RULES.values()}


def scoped_applications(user):
    qs = LandApplication.objects.all()
    if user.is_provincial:
        qs = qs.filter(province=user.province)
    return qs


class ApplicationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    lookup_field = "reference"
    filterset_class = ApplicationFilter
    ordering_fields = ["date_received", "created_at", "updated_at", "surname", "application_no"]
    ordering = ["-created_at"]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = scoped_applications(self.request.user).select_related("assigned_to", "created_by")
        if self.action in ("list", "export"):
            qs = qs.annotate(attachment_count=Count("attachments"))
        else:
            qs = qs.prefetch_related(
                "attachments__uploaded_by",
                "reviews__recorded_by",
                "notifications__triggered_by",
            )
        if self.request.query_params.get("queue") == "mine":
            qs = qs.filter(status=ROLE_QUEUE.get(self.request.user.role, "__none__"))
        return qs

    def get_serializer_class(self):
        if self.action in ("list",):
            return ApplicationListSerializer
        return ApplicationDetailSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_admin or user.role in (Role.CAPTURE_OFFICER, Role.LAND_OFFICER)):
            raise PermissionDenied("Your role cannot capture new applications.")
        application = serializer.save(created_by=user)
        workflow.log(
            application, user, Activity.Verb.CREATED,
            message="Captured application at Head Office",
            to_status=application.status,
        )
        notify_farmer_async(application, ApplicantNotification.Event.RECEIVED, actor=user)

    def perform_update(self, serializer):
        user = self.request.user
        if not workflow.can_edit(user, serializer.instance):
            raise PermissionDenied("This application can no longer be edited.")
        changed = [
            field for field, value in serializer.validated_data.items()
            if getattr(serializer.instance, field) != value
        ]
        application = serializer.save()
        if changed:
            workflow.log(
                application, user, Activity.Verb.UPDATED,
                message=", ".join(f.replace("_", " ") for f in changed),
                fields=changed,
            )

    def perform_destroy(self, instance):
        if not workflow.can_delete(self.request.user, instance):
            raise PermissionDenied("You do not have permission to delete this application.")
        for attachment in instance.attachments.all():
            if attachment.file:
                attachment.file.delete(save=False)
        instance.delete()

    # ---- workflow --------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def decide(self, request, reference=None):
        application = self.get_object()
        serializer = DecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = workflow.record_decision(application, request.user, serializer.validated_data)
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def resubmit(self, request, reference=None):
        application = workflow.resubmit(self.get_object(), request.user, request.data.get("note", ""))
        return Response(self._detail(application))

    @action(detail=True, methods=["post"])
    def withdraw(self, request, reference=None):
        application = workflow.withdraw(
            self.get_object(), request.user, request.data.get("reason", "")
        )
        return Response(self._detail(application))

    @action(detail=True, methods=["post"])
    def notes(self, request, reference=None):
        application = self.get_object()
        message = (request.data.get("message") or "").strip()
        if not message:
            raise ValidationError({"message": "Note cannot be empty."})
        activity = workflow.log(application, request.user, Activity.Verb.NOTE, message=message[:2000])
        return Response(ActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def activity(self, request, reference=None):
        application = self.get_object()
        qs = application.activities.select_related("actor")
        return Response(ActivitySerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def notify(self, request, reference=None):
        application = self.get_object()
        event = request.data.get("event") or (
            ApplicantNotification.Event.APPROVED
            if application.status == Status.APPROVED
            else ApplicantNotification.Event.RECEIVED
        )
        if event not in (
            ApplicantNotification.Event.RECEIVED,
            ApplicantNotification.Event.APPROVED,
        ):
            raise ValidationError({"event": "Unsupported notification stage."})
        if (
            event == ApplicantNotification.Event.APPROVED
            and application.status != Status.APPROVED
        ):
            raise ValidationError(
                {"detail": "Approval notification can only be sent once the application is approved."}
            )
        dispatched = notify_farmer(application, event, actor=request.user)
        return Response(
            ApplicantNotificationSerializer(dispatched, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    # ---- attachments -----------------------------------------------------------------
    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, reference=None):
        application = self.get_object()
        if request.method == "GET":
            qs = application.attachments.select_related("uploaded_by")
            return Response(AttachmentSerializer(qs, many=True).data)

        if not workflow.can_upload(request.user, application):
            raise PermissionDenied("Attachments can no longer be added to this application.")
        serializer = AttachmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment = serializer.save(application=application, uploaded_by=request.user)
        workflow.log(
            application, request.user, Activity.Verb.UPLOADED,
            message=f"{attachment.get_doc_type_display()} · {attachment.original_name}",
            attachment_id=attachment.pk,
        )
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True, methods=["delete"], url_path=r"attachments/(?P<attachment_id>\d+)"
    )
    def remove_attachment(self, request, reference=None, attachment_id=None):
        application = self.get_object()
        attachment = get_object_or_404(application.attachments, pk=attachment_id)
        if not workflow.can_upload(request.user, application):
            raise PermissionDenied("Attachments on this application are locked.")
        if not (request.user.is_admin or attachment.uploaded_by_id == request.user.pk):
            raise PermissionDenied("Only the officer who uploaded this file can remove it.")
        label = f"{attachment.get_doc_type_display()} · {attachment.original_name}"
        attachment.delete()
        workflow.log(application, request.user, Activity.Verb.REMOVED, message=label)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True, methods=["get"], url_path=r"attachments/(?P<attachment_id>\d+)/file"
    )
    def download_attachment(self, request, reference=None, attachment_id=None):
        application = self.get_object()
        attachment = get_object_or_404(Attachment, pk=attachment_id, application=application)
        inline = request.query_params.get("inline") == "1"
        response = FileResponse(
            attachment.file.open("rb"),
            content_type=attachment.content_type,
            as_attachment=not inline,
            filename=attachment.original_name,
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    # ---- export ----------------------------------------------------------------------
    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.filter_queryset(self.get_queryset())[:10000]
        response = HttpResponse(content_type="text/csv")
        stamp = timezone.localtime().strftime("%Y%m%d-%H%M")
        response["Content-Disposition"] = f'attachment; filename="applications-{stamp}.csv"'
        writer = csv.writer(response)
        writer.writerow([
            "Application No", "Date Received", "Receiving Province", "Title", "Surname",
            "Other Names", "Sex", "National ID", "Occupation", "Preferred Province",
            "Preferred District", "Farm Type", "Farming Type", "Status", "Attachments",
        ])
        for app in qs:
            writer.writerow([
                app.application_no, app.date_received.isoformat(), app.get_province_display(),
                app.get_title_display(), app.surname, app.other_names, app.get_sex_display(),
                app.national_id, app.occupation, app.get_preferred_province_display(),
                app.preferred_district, app.get_farm_type_display(),
                app.get_farming_type_display(), app.get_status_display(), app.attachment_count,
            ])
        return response

    def _detail(self, application):
        application.refresh_from_db()
        return ApplicationDetailSerializer(application, context={"request": self.request}).data


class StatsView(APIView):
    def get(self, request):
        user = request.user
        qs = scoped_applications(user)
        today = timezone.localdate()

        by_status = dict(qs.values_list("status").annotate(n=Count("id")).order_by())
        total = sum(by_status.values())
        open_count = sum(v for k, v in by_status.items() if k not in FINAL_STATUSES)

        start = (today.replace(day=1) - timedelta(days=330)).replace(day=1)
        monthly_rows = (
            qs.filter(date_received__gte=start)
            .annotate(month=TruncMonth("date_received"))
            .values("month")
            .annotate(
                received=Count("id"),
                approved=Count("id", filter=Q(status=Status.APPROVED)),
            )
            .order_by("month")
        )
        monthly_map = {row["month"].strftime("%Y-%m"): row for row in monthly_rows}
        monthly = []
        cursor = start
        for _ in range(12):
            key = cursor.strftime("%Y-%m")
            row = monthly_map.get(key, {})
            monthly.append({
                "month": key,
                "received": row.get("received", 0),
                "approved": row.get("approved", 0),
            })
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

        by_province = list(
            qs.values("preferred_province").annotate(n=Count("id")).order_by("-n")
        )
        by_farm_type = list(qs.values("farm_type").annotate(n=Count("id")).order_by("-n"))
        by_sex = dict(qs.values_list("sex").annotate(n=Count("id")).order_by())

        decided = qs.filter(decided_at__isnull=False, status__in=[Status.APPROVED, Status.REJECTED])
        avg = decided.aggregate(avg=Avg(F("decided_at") - F("created_at")))["avg"]

        queue_status = ROLE_QUEUE.get(user.role)
        my_queue = qs.filter(status=queue_status).count() if queue_status else 0

        stale = qs.filter(
            status__in=[Status.RECEIVED, Status.COMMITTEE, Status.BOARD, Status.MINISTER],
            updated_at__lt=timezone.now() - timedelta(days=30),
        ).count()

        incomplete = (
            qs.filter(status__in=[Status.RECEIVED, Status.QUERIED])
            .exclude(
                Q(attachments__doc_type=AttachmentType.NATIONAL_ID)
            )
            .distinct()
            .count()
        )

        recent = Activity.objects.filter(application__in=qs).select_related(
            "actor", "application"
        )[:8]

        return Response({
            "total": total,
            "open": open_count,
            "this_month": qs.filter(
                date_received__year=today.year, date_received__month=today.month
            ).count(),
            "by_status": by_status,
            "monthly": monthly,
            "by_province": by_province,
            "by_farm_type": by_farm_type,
            "by_sex": by_sex,
            "avg_decision_days": round(avg.total_seconds() / 86400, 1) if avg else None,
            "my_queue": my_queue,
            "stale": stale,
            "missing_id": incomplete,
            "recent": [
                {
                    **ActivitySerializer(a).data,
                    "application_no": a.application.application_no,
                    "application_reference": str(a.application.reference),
                    "applicant": a.application.full_name,
                }
                for a in recent
            ],
        })


def _choices(enum):
    return [{"value": value, "label": label} for value, label in enum.choices]


class MetaView(APIView):
    """Reference data the frontend needs to render forms and labels."""

    def get(self, request):
        return Response({
            "provinces": _choices(Province),
            "districts": {str(k): v for k, v in DISTRICTS.items()},
            "titles": _choices(Title),
            "sexes": _choices(Sex),
            "marital_statuses": _choices(MaritalStatus),
            "farm_types": _choices(FarmType),
            "farming_types": _choices(FarmingType),
            "categories": _choices(ApplicantCategory),
            "sources": _choices(Source),
            "natural_regions": _choices(NaturalRegion),
            "statuses": _choices(Status),
            "stages": _choices(Stage),
            "outcome_labels": {str(k): v for k, v in OUTCOME_LABELS.items()},
            "attachment_types": _choices(AttachmentType),
            "required_attachments": [str(a) for a in REQUIRED_ATTACHMENTS],
            "roles": _choices(Role),
            "farm_size_schedule": FARM_SIZE_SCHEDULE,
            "peri_urban_size": PERI_URBAN_SIZE,
        })


class SmsGatewayDispatchView(APIView):
    """
    Sample & diagnostic API endpoint (`GET/POST /api/sms-gateway/send/`) for
    checking the Android SMS Gateway configuration and dispatching an SMS
    either synchronously or asynchronously (`async_dispatch=true`).
    """

    def get(self, request):
        from django.conf import settings

        gateway_url = getattr(settings, "ANDROID_SMS_GATEWAY_URL", "")
        has_secret = bool(getattr(settings, "SMS_GATEWAY_SECRET_KEY", ""))
        return Response({
            "configured": bool(gateway_url),
            "gateway_url": gateway_url or None,
            "secret_key_configured": has_secret,
            "timeout_seconds": getattr(settings, "SMS_GATEWAY_TIMEOUT_SECONDS", 8.0),
        })

    def post(self, request):
        user = request.user
        if not (user.is_admin or user.role in (Role.CAPTURE_OFFICER, Role.LAND_OFFICER)):
            raise PermissionDenied("Your role cannot dispatch manual SMS notifications.")

        serializer = SmsGatewayDispatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone_number = serializer.validated_data["phone_number"]
        message = serializer.validated_data["message"]
        async_dispatch = serializer.validated_data.get("async_dispatch", False)

        if async_dispatch:
            dispatch_sms_async(phone_number=phone_number, message=message)
            return Response(
                {
                    "queued": True,
                    "phone_number": phone_number,
                    "detail": "SMS scheduled asynchronously via transaction.on_commit worker.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        result = send_sms_via_android_gateway(phone_number=phone_number, message=message)
        http_status = status.HTTP_200_OK if result.success else status.HTTP_502_BAD_GATEWAY
        return Response(
            {
                "success": result.success,
                "simulated": result.simulated,
                "gateway_status_code": result.status_code,
                "error_message": result.error_message,
                "gateway_response": result.response_payload,
            },
            status=http_status,
        )


