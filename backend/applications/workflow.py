"""
Workflow rules for moving an application through the official-use sections.

    RECEIVED ──D──▶ COMMITTEE ──E──▶ BOARD ──F──▶ MINISTER ──G──▶ APPROVED
       │  ▲                │               │                │
       ▼  │ resubmit       ▼               ▼                ▼
     QUERIED            REJECTED        REJECTED         REJECTED
"""
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role

from .constants import FINAL_STATUSES, OUTCOME_LABELS, AttachmentType, Outcome, Stage, Status
from .models import Activity, ApplicantNotification, LandApplication, Review
from .notifications import notify_farmer


@dataclass(frozen=True)
class StageRule:
    stage: str
    from_status: str
    role: str
    on_positive: str
    on_negative: str
    allows_query: bool = False


STAGE_RULES: dict[str, StageRule] = {
    Stage.LAND_OFFICER: StageRule(
        Stage.LAND_OFFICER, Status.RECEIVED, Role.LAND_OFFICER,
        on_positive=Status.COMMITTEE,
        # The CLO only comments; an unsupported application still goes to committee.
        on_negative=Status.COMMITTEE,
        allows_query=True,
    ),
    Stage.COMMITTEE: StageRule(
        Stage.COMMITTEE, Status.COMMITTEE, Role.COMMITTEE,
        on_positive=Status.BOARD, on_negative=Status.REJECTED,
    ),
    Stage.BOARD: StageRule(
        Stage.BOARD, Status.BOARD, Role.BOARD,
        on_positive=Status.MINISTER, on_negative=Status.REJECTED,
    ),
    Stage.MINISTER: StageRule(
        Stage.MINISTER, Status.MINISTER, Role.MINISTER,
        on_positive=Status.APPROVED, on_negative=Status.REJECTED,
    ),
}

STATUS_TO_STAGE = {rule.from_status: rule.stage for rule in STAGE_RULES.values()}


def current_stage(application: LandApplication) -> str | None:
    return STATUS_TO_STAGE.get(application.status)


def can_decide(user, application: LandApplication) -> bool:
    stage = current_stage(application)
    if not stage:
        return False
    if user.is_admin:
        return True
    rule = STAGE_RULES[stage]
    if user.role != rule.role:
        return False
    if user.is_provincial and user.province != application.province:
        return False
    return True


def can_edit(user, application: LandApplication) -> bool:
    if application.status not in (Status.RECEIVED, Status.QUERIED):
        return False
    if user.is_admin:
        return True
    if user.role not in (Role.CAPTURE_OFFICER, Role.LAND_OFFICER):
        return False
    return not user.is_provincial or user.province == application.province


def can_upload(user, application: LandApplication) -> bool:
    if application.status in FINAL_STATUSES:
        return False
    if user.is_admin:
        return True
    if user.role not in (Role.CAPTURE_OFFICER, Role.LAND_OFFICER):
        return False
    return not user.is_provincial or user.province == application.province


def log(application, actor, verb, message="", from_status="", to_status="", **meta):
    return Activity.objects.create(
        application=application,
        actor=actor,
        verb=verb,
        message=message,
        from_status=from_status,
        to_status=to_status,
        meta=meta,
    )


@transaction.atomic
def record_decision(application: LandApplication, user, data: dict) -> Review:
    application = LandApplication.objects.select_for_update().get(pk=application.pk)
    stage = current_stage(application)
    if not stage:
        raise ValidationError({"detail": "This application is not awaiting a decision."})
    if not can_decide(user, application):
        raise PermissionDenied(
            f"Section {stage} must be completed by the {STAGE_RULES[stage].role.label}."
        )

    rule = STAGE_RULES[stage]
    outcome = data["outcome"]

    if outcome == Outcome.QUERY and not rule.allows_query:
        raise ValidationError({"outcome": "Queries can only be raised by the Chief Land Officer."})
    if outcome == Outcome.QUERY and not data.get("comments", "").strip():
        raise ValidationError({"comments": "Explain what is required from the applicant."})
    if stage == Stage.LAND_OFFICER and outcome != Outcome.QUERY:
        missing = application.missing_required_attachments
        if missing:
            labels = ", ".join(AttachmentType(m).label for m in missing)
            raise ValidationError(
                {"detail": f"Cannot forward to Committee. Missing attachments: {labels}."}
            )
    if stage == Stage.COMMITTEE and not data.get("meeting_date"):
        raise ValidationError({"meeting_date": "Enter the date of the Committee meeting."})

    if outcome == Outcome.QUERY:
        new_status = Status.QUERIED
    elif outcome == Outcome.POSITIVE:
        new_status = rule.on_positive
    else:
        new_status = rule.on_negative

    review = Review.objects.create(
        application=application,
        stage=stage,
        outcome=outcome,
        comments=data.get("comments", ""),
        meeting_date=data.get("meeting_date"),
        decision_date=data.get("decision_date") or timezone.localdate(),
        signatory_name=data.get("signatory_name") or user.get_full_name() or user.username,
        signatory_designation=data.get("signatory_designation", ""),
        recorded_by=user,
    )

    allocation_fields = []
    for field in ("allocated_unit", "allocated_hectares", "natural_region"):
        if data.get(field) not in (None, ""):
            setattr(application, field, data[field])
            allocation_fields.append(field)

    old_status = application.status
    application.status = new_status
    update_fields = ["status", "updated_at", *allocation_fields]
    if new_status in FINAL_STATUSES:
        application.decided_at = timezone.now()
        update_fields.append("decided_at")
    application.save(update_fields=update_fields)

    label = OUTCOME_LABELS[stage].get(outcome, outcome)
    log(
        application, user, Activity.Verb.REVIEWED,
        message=f"Section {stage}: {label}",
        from_status=old_status, to_status=new_status,
        stage=stage, outcome=outcome, review_id=review.pk,
    )
    if new_status == Status.APPROVED:
        notify_farmer(application, ApplicantNotification.Event.APPROVED, actor=user)
    return review


@transaction.atomic
def resubmit(application: LandApplication, user, note: str = "") -> LandApplication:
    if application.status != Status.QUERIED:
        raise ValidationError({"detail": "Only queried applications can be resubmitted."})
    if not can_edit(user, application):
        raise PermissionDenied("You cannot resubmit this application.")
    application.status = Status.RECEIVED
    application.save(update_fields=["status", "updated_at"])
    log(
        application, user, Activity.Verb.RESUBMITTED, message=note,
        from_status=Status.QUERIED, to_status=Status.RECEIVED,
    )
    return application


@transaction.atomic
def withdraw(application: LandApplication, user, reason: str) -> LandApplication:
    if application.status in FINAL_STATUSES:
        raise ValidationError({"detail": "This application has already been finalised."})
    if not (user.is_admin or can_upload(user, application)):
        raise PermissionDenied("You cannot withdraw this application.")
    if not reason.strip():
        raise ValidationError({"reason": "A reason is required."})
    old = application.status
    application.status = Status.WITHDRAWN
    application.decided_at = timezone.now()
    application.save(update_fields=["status", "decided_at", "updated_at"])
    log(
        application, user, Activity.Verb.WITHDRAWN, message=reason,
        from_status=old, to_status=Status.WITHDRAWN,
    )
    return application

