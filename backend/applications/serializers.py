from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User

from . import workflow
from .constants import DISTRICTS, OUTCOME_LABELS, FarmingType, Outcome, Stage
from .models import (
    NATIONAL_ID_RE,
    Activity,
    ApplicantNotification,
    Attachment,
    LandApplication,
    Review,
    normalise_national_id,
)
from .validators import validate_attachment


class OfficerSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "role", "role_display", "province"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class AttachmentSerializer(serializers.ModelSerializer):
    doc_type_display = serializers.CharField(source="get_doc_type_display", read_only=True)
    uploaded_by = OfficerSummarySerializer(read_only=True)
    file = serializers.FileField(write_only=True)

    class Meta:
        model = Attachment
        fields = [
            "id",
            "doc_type",
            "doc_type_display",
            "file",
            "original_name",
            "content_type",
            "size",
            "note",
            "uploaded_by",
            "uploaded_at",
        ]
        read_only_fields = ["original_name", "content_type", "size", "uploaded_at"]

    def validate_file(self, upload):
        try:
            self._content_type = validate_attachment(upload)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return upload

    def create(self, validated_data):
        upload = validated_data["file"]
        validated_data.update(
            original_name=upload.name[:255],
            content_type=self._content_type,
            size=upload.size,
        )
        return super().create(validated_data)


class ReviewSerializer(serializers.ModelSerializer):
    stage_display = serializers.CharField(source="get_stage_display", read_only=True)
    outcome_display = serializers.SerializerMethodField()
    recorded_by = OfficerSummarySerializer(read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "stage",
            "stage_display",
            "outcome",
            "outcome_display",
            "comments",
            "meeting_date",
            "decision_date",
            "signatory_name",
            "signatory_designation",
            "recorded_by",
            "created_at",
        ]

    def get_outcome_display(self, obj):
        return OUTCOME_LABELS.get(obj.stage, {}).get(obj.outcome, obj.get_outcome_display())


class DecisionSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=Outcome.choices)
    comments = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    meeting_date = serializers.DateField(required=False, allow_null=True)
    decision_date = serializers.DateField(required=False, allow_null=True)
    signatory_name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    signatory_designation = serializers.CharField(required=False, allow_blank=True, max_length=120)
    allocated_unit = serializers.CharField(required=False, allow_blank=True, max_length=120)
    allocated_hectares = serializers.DecimalField(
        max_digits=9, decimal_places=2, required=False, allow_null=True, min_value=Decimal("0")
    )
    natural_region = serializers.CharField(required=False, allow_blank=True, max_length=4)

    def validate_decision_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("Decision date cannot be in the future.")
        return value


class ActivitySerializer(serializers.ModelSerializer):
    actor = OfficerSummarySerializer(read_only=True)
    verb_display = serializers.CharField(source="get_verb_display", read_only=True)

    class Meta:
        model = Activity
        fields = [
            "id",
            "verb",
            "verb_display",
            "message",
            "from_status",
            "to_status",
            "meta",
            "actor",
            "created_at",
        ]


class ApplicantNotificationSerializer(serializers.ModelSerializer):
    event_display = serializers.CharField(source="get_event_display", read_only=True)
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    triggered_by = OfficerSummarySerializer(read_only=True)

    class Meta:
        model = ApplicantNotification
        fields = [
            "id",
            "event",
            "event_display",
            "channel",
            "channel_display",
            "recipient",
            "subject",
            "body",
            "status",
            "status_display",
            "error_message",
            "triggered_by",
            "sent_at",
        ]



class ApplicationListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    province_display = serializers.CharField(source="get_province_display", read_only=True)
    preferred_province_display = serializers.CharField(
        source="get_preferred_province_display", read_only=True
    )
    farm_type_display = serializers.CharField(source="get_farm_type_display", read_only=True)
    farming_type_display = serializers.CharField(source="get_farming_type_display", read_only=True)
    attachment_count = serializers.IntegerField(read_only=True)
    assigned_to = OfficerSummarySerializer(read_only=True)

    class Meta:
        model = LandApplication
        fields = [
            "id",
            "reference",
            "application_no",
            "title",
            "surname",
            "other_names",
            "full_name",
            "national_id",
            "sex",
            "province",
            "province_display",
            "preferred_province",
            "preferred_province_display",
            "preferred_district",
            "farm_type",
            "farm_type_display",
            "farming_type",
            "farming_type_display",
            "status",
            "status_display",
            "date_received",
            "attachment_count",
            "assigned_to",
            "created_at",
            "updated_at",
        ]


class ApplicationDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    reviews = ReviewSerializer(many=True, read_only=True)
    notifications = ApplicantNotificationSerializer(many=True, read_only=True)
    created_by = OfficerSummarySerializer(read_only=True)
    assigned_to = OfficerSummarySerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=User.objects.filter(is_active=True),
        write_only=True,
        required=False,
        allow_null=True,
    )
    missing_attachments = serializers.SerializerMethodField()
    current_stage = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    duplicates = serializers.SerializerMethodField()

    class Meta:
        model = LandApplication
        exclude = ["id"]
        read_only_fields = [
            "reference",
            "application_no",
            "status",
            "natural_region",
            "allocated_unit",
            "allocated_hectares",
            "created_at",
            "updated_at",
            "decided_at",
        ]

    # ---- computed --------------------------------------------------------------------
    def get_missing_attachments(self, obj):
        return obj.missing_required_attachments

    def get_current_stage(self, obj):
        stage = workflow.current_stage(obj)
        if not stage:
            return None
        rule = workflow.STAGE_RULES[stage]
        return {
            "code": stage,
            "label": Stage(stage).label,
            "role": rule.role,
            "role_display": rule.role.label,
            "outcomes": OUTCOME_LABELS[stage],
        }

    def get_permissions(self, obj):
        user = self.context["request"].user
        return {
            "edit": workflow.can_edit(user, obj),
            "upload": workflow.can_upload(user, obj),
            "decide": workflow.can_decide(user, obj),
            "withdraw": workflow.can_upload(user, obj),
        }

    def get_duplicates(self, obj):
        others = (
            LandApplication.objects.filter(national_id=obj.national_id)
            .exclude(pk=obj.pk)
            .values("reference", "application_no", "status", "date_received")
        )
        return list(others)

    # ---- validation ------------------------------------------------------------------
    def validate_national_id(self, value):
        if not NATIONAL_ID_RE.match(value.upper().replace(" ", "")):
            raise serializers.ValidationError("Use the format 63-1234567A89.")
        return normalise_national_id(value)

    def validate_declaration_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Declaration date cannot be in the future.")
        return value

    def validate(self, attrs):
        get = lambda key: attrs.get(key, getattr(self.instance, key, None))  # noqa: E731

        province = get("preferred_province")
        district = get("preferred_district")
        if province and district and district not in DISTRICTS.get(province, []):
            raise serializers.ValidationError(
                {"preferred_district": "District does not belong to the selected province."}
            )

        if get("farming_type") == FarmingType.OTHER and not (get("farming_type_other") or "").strip():
            raise serializers.ValidationError(
                {"farming_type_other": "Specify the type of farming."}
            )

        if not get("declaration_signed"):
            raise serializers.ValidationError(
                {"declaration_signed": "The applicant must sign the declaration (Section C)."}
            )

        if not any(get(f) for f in ("business_phone", "residential_phone", "mobile_phone")):
            raise serializers.ValidationError(
                {"mobile_phone": "Provide at least one contact number."}
            )

        user = self.context["request"].user
        if user.is_provincial and attrs.get("province") and attrs["province"] != user.province:
            raise serializers.ValidationError(
                {"province": "You can only capture applications for your own province."}
            )
        return attrs
