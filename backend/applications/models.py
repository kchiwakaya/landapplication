import os
import re
import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.contrib.postgres.indexes import GinIndex
from django.db import models, transaction
from django.utils import timezone

from .constants import (
    PROVINCE_CODES,
    REQUIRED_ATTACHMENTS,
    ApplicantCategory,
    AttachmentType,
    FarmingType,
    FarmType,
    MaritalStatus,
    NaturalRegion,
    Outcome,
    Province,
    Sex,
    Source,
    Stage,
    Status,
    Title,
)

NATIONAL_ID_RE = re.compile(r"^(\d{2})-?(\d{6,7})\s*([A-Z])\s*(\d{2})$")


def normalise_national_id(value: str) -> str:
    """Normalise a Zimbabwean ID number to the canonical `63-1234567A89` form."""
    cleaned = re.sub(r"[\s]", "", (value or "").upper())
    match = NATIONAL_ID_RE.match(cleaned)
    if not match:
        return cleaned
    return f"{match.group(1)}-{match.group(2)}{match.group(3)}{match.group(4)}"


class ApplicationSequence(models.Model):
    """Per-province, per-year counter used to issue application form numbers."""

    province = models.CharField(max_length=32, choices=Province.choices)
    year = models.PositiveIntegerField()
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["province", "year"], name="uniq_sequence_province_year")
        ]

    @classmethod
    def next_number(cls, province: str, year: int) -> str:
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(province=province, year=year)
            seq.last_value += 1
            seq.save(update_fields=["last_value"])
        return f"A2/{PROVINCE_CODES[province]}/{year}/{seq.last_value:05d}"


class LandApplication(models.Model):
    # ---- Registry ------------------------------------------------------------------
    reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    application_no = models.CharField(max_length=32, unique=True, editable=False)
    province = models.CharField(
        max_length=32, choices=Province.choices, help_text="Receiving province office."
    )
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.WALK_IN)
    date_received = models.DateField(default=timezone.localdate)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.RECEIVED, db_index=True
    )

    # ---- Section A: Particulars of the applicant ------------------------------------
    title = models.CharField(max_length=8, choices=Title.choices)
    surname = models.CharField(max_length=80)
    other_names = models.CharField(max_length=120)
    sex = models.CharField(max_length=8, choices=Sex.choices)
    marital_status = models.CharField(max_length=12, choices=MaritalStatus.choices)
    national_id = models.CharField("R.C. No. / I.D. No.", max_length=20, db_index=True)
    date_of_birth = models.DateField(null=True, blank=True)
    categories = ArrayField(
        models.CharField(max_length=24, choices=ApplicantCategory.choices),
        default=list,
        blank=True,
    )

    postal_address = models.TextField(blank=True)
    residential_address = models.TextField()
    business_phone = models.CharField(max_length=32, blank=True)
    residential_phone = models.CharField(max_length=32, blank=True)
    mobile_phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=120)

    # ---- Section B: Area preferred --------------------------------------------------
    preferred_province = models.CharField(max_length=32, choices=Province.choices)
    preferred_district = models.CharField(max_length=64)
    farm_type = models.CharField(max_length=16, choices=FarmType.choices)
    farming_type = models.CharField(max_length=16, choices=FarmingType.choices)
    farming_type_other = models.CharField(max_length=120, blank=True)
    experience_summary = models.TextField(
        blank=True, help_text="Statement of training or experience in the agri-industry."
    )
    resources_summary = models.TextField(
        blank=True, help_text="Cash and/or movable assets available for the farming programme."
    )

    # ---- Section C: Declaration -----------------------------------------------------
    declaration_name = models.CharField(max_length=200)
    declaration_date = models.DateField()
    declaration_signed = models.BooleanField(default=False)

    # ---- Allocation (completed from Section E onwards) ------------------------------
    natural_region = models.CharField(max_length=4, choices=NaturalRegion.choices, blank=True)
    allocated_unit = models.CharField(max_length=120, blank=True)
    allocated_hectares = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True)

    # ---- Audit ----------------------------------------------------------------------
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="captured_applications"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_applications",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["province", "status"]),
            models.Index(fields=["surname", "other_names"]),
            models.Index(fields=["date_received"]),
            GinIndex(fields=["categories"]),
        ]

    def __str__(self) -> str:
        return f"{self.application_no} – {self.full_name}"

    @property
    def full_name(self) -> str:
        return f"{self.other_names} {self.surname}".strip()

    @property
    def missing_required_attachments(self) -> list[str]:
        present = set(self.attachments.values_list("doc_type", flat=True))
        return [doc for doc in REQUIRED_ATTACHMENTS if doc not in present]

    def save(self, *args, **kwargs):
        self.national_id = normalise_national_id(self.national_id)
        self.surname = self.surname.strip().upper()
        self.other_names = self.other_names.strip().upper()
        if not self.application_no:
            year = (self.date_received or timezone.localdate()).year
            self.application_no = ApplicationSequence.next_number(self.province, year)
        super().save(*args, **kwargs)


def attachment_upload_to(instance: "Attachment", filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return f"applications/{instance.application.reference}/{uuid.uuid4().hex}{ext}"


class Attachment(models.Model):
    application = models.ForeignKey(
        LandApplication, on_delete=models.CASCADE, related_name="attachments"
    )
    doc_type = models.CharField(max_length=24, choices=AttachmentType.choices)
    file = models.FileField(upload_to=attachment_upload_to, max_length=255)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField()
    note = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["doc_type", "-uploaded_at"]

    def __str__(self) -> str:
        return f"{self.get_doc_type_display()} – {self.original_name}"

    def delete(self, *args, **kwargs):
        storage, name = self.file.storage, self.file.name
        super().delete(*args, **kwargs)
        if name:
            storage.delete(name)


class Review(models.Model):
    """A decision recorded against one of the official-use sections (D–G)."""

    application = models.ForeignKey(
        LandApplication, on_delete=models.CASCADE, related_name="reviews"
    )
    stage = models.CharField(max_length=1, choices=Stage.choices)
    outcome = models.CharField(max_length=10, choices=Outcome.choices)
    comments = models.TextField(blank=True)
    meeting_date = models.DateField(null=True, blank=True, help_text="Section E only.")
    decision_date = models.DateField(default=timezone.localdate)
    signatory_name = models.CharField(max_length=200)
    signatory_designation = models.CharField(max_length=120, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.application.application_no} – Section {self.stage}: {self.outcome}"


class Activity(models.Model):
    """Append-only audit trail for an application."""

    class Verb(models.TextChoices):
        CREATED = "created", "Captured application"
        UPDATED = "updated", "Updated particulars"
        UPLOADED = "uploaded", "Uploaded attachment"
        REMOVED = "removed", "Removed attachment"
        REVIEWED = "reviewed", "Recorded decision"
        RESUBMITTED = "resubmitted", "Resubmitted after query"
        WITHDRAWN = "withdrawn", "Withdrew application"
        ASSIGNED = "assigned", "Assigned officer"
        NOTE = "note", "Added note"

    application = models.ForeignKey(
        LandApplication, on_delete=models.CASCADE, related_name="activities"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+"
    )
    verb = models.CharField(max_length=16, choices=Verb.choices)
    message = models.TextField(blank=True)
    from_status = models.CharField(max_length=16, choices=Status.choices, blank=True)
    to_status = models.CharField(max_length=16, choices=Status.choices, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "activities"

    def __str__(self) -> str:
        return f"{self.application.application_no} – {self.get_verb_display()}"

