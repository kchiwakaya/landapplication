"""
Farmer (applicant) notification service for the two statutory milestones:
  1. Application received (`application_received`)
  2. Application approved (`application_approved`)

Dispatches SMS (to the applicant's primary phone number) and Email (if an
email address was provided on the form), records each dispatch in
`ApplicantNotification`, and appends an audit trail entry in `Activity`.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import Activity, ApplicantNotification, LandApplication
from .sms_gateway import run_after_commit_async, send_sms_via_android_gateway

logger = logging.getLogger(__name__)


def _applicant_phone(app: LandApplication) -> str:
    return (app.mobile_phone or app.residential_phone or app.business_phone or "").strip()


def _compose_received(app: LandApplication) -> tuple[str, str, str]:
    title_name = f"{app.get_title_display()} {app.full_name}"
    d = app.date_received or timezone.localdate()
    receipt_date = f"{d.day} {d.strftime('%B %Y')}"

    sms_body = (
        f"We acknowledge receipt of your application for land under the Land Reform "
        f"and National Resettlement Programme, dated {receipt_date}.\n"
        f"Please note that the Ministry is currently processing your application. "
        f"You will be contacted as and when land becomes available.\n"
        f"Thank you for your patience."
    )

    subject = f"Application Received – Form No. {app.application_no}"
    email_body = (
        f"MINISTRY OF LANDS AND RURAL DEVELOPMENT\n"
        f"Land Reform and Resettlement Programme (Phase II, Model A2)\n"
        f"------------------------------------------------------------\n\n"
        f"Dear {title_name},\n\n"
        f"We acknowledge receipt of your application for land under the Land Reform "
        f"and National Resettlement Programme, dated {receipt_date}.\n\n"
        f"Please note that the Ministry is currently processing your application. "
        f"You will be contacted as and when land becomes available.\n\n"
        f"Thank you for your patience.\n\n"
        f"Application Form No.: {app.application_no}\n\n"
        f"Yours faithfully,\n"
        f"Ministry of Lands and Rural Development (Head Office)"
    )
    return subject, sms_body, email_body


def _compose_approved(app: LandApplication) -> tuple[str, str, str]:
    pref_province = app.get_preferred_province_display()
    title_name = f"{app.get_title_display()} {app.full_name}"

    unit_parts = []
    if app.allocated_unit:
        unit_parts.append(app.allocated_unit)
    if app.allocated_hectares:
        unit_parts.append(f"{app.allocated_hectares} ha")
    if app.natural_region:
        unit_parts.append(f"Region {app.natural_region}")
    unit_summary = ", ".join(unit_parts) if unit_parts else f"{app.preferred_district}, {pref_province}"

    sms_body = (
        f"MINISTRY OF LANDS: Dear {title_name}, your land application "
        f"(Form No. {app.application_no}) has been APPROVED ({unit_summary}). "
        f"Please report to the Ministry of Lands Head Office with your National ID."
    )

    subject = f"Application Approved – Form No. {app.application_no} (Model A2 Scheme)"
    email_body = (
        f"MINISTRY OF LANDS AND RURAL DEVELOPMENT\n"
        f"Land Reform and Resettlement Programme (Phase II, Model A2)\n"
        f"------------------------------------------------------------\n\n"
        f"Dear {title_name},\n\n"
        f"We are pleased to inform you that your application for an agricultural land "
        f"holding under the Commercial Farm Settlement Scheme (Model A2), in terms of "
        f"the Agricultural Land Settlement Act (Chapter 20:01), has been APPROVED by "
        f"the Minister of Lands and Rural Development.\n\n"
        f"Approval Details:\n"
        f"  • Application Form No. : {app.application_no}\n"
        f"  • Applicant            : {title_name} (ID: {app.national_id})\n"
        f"  • District / Province  : {app.preferred_district}, {pref_province}\n"
        f"  • Allocated Holding    : {unit_summary}\n\n"
        f"Next Steps:\n"
        f"Please report to the Ministry of Lands and Rural Development Head Office "
        f"with your original National ID ({app.national_id}) to complete tenure "
        f"documentation and settlement formalities.\n\n"
        f"Yours faithfully,\n"
        f"Office of the Minister of Lands and Rural Development\n"
        f"Republic of Zimbabwe"
    )
    return subject, sms_body, email_body


def _send_sms(recipient: str, body: str) -> tuple[str, str]:
    result = send_sms_via_android_gateway(phone_number=recipient, message=body)
    if result.success:
        return ApplicantNotification.DeliveryStatus.SENT, ""
    return ApplicantNotification.DeliveryStatus.FAILED, result.error_message


def _send_email(recipient: str, subject: str, body: str) -> tuple[str, str]:
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
        return ApplicantNotification.DeliveryStatus.SENT, ""
    except Exception as exc:
        logger.warning("Email error for %s: %s", recipient, exc)
        return ApplicantNotification.DeliveryStatus.FAILED, str(exc)


def notify_farmer(
    application: LandApplication,
    event: str,
    actor=None,
) -> list[ApplicantNotification]:
    """
    Send farmer notifications (SMS and/or Email) for `application_received`
    or `application_approved`. Returns the created `ApplicantNotification` rows.
    """
    if event == ApplicantNotification.Event.RECEIVED:
        subject, sms_body, email_body = _compose_received(application)
    elif event == ApplicantNotification.Event.APPROVED:
        subject, sms_body, email_body = _compose_approved(application)
    else:
        raise ValueError(f"Unsupported notification event: {event}")

    dispatched: list[ApplicantNotification] = []

    phone = _applicant_phone(application)
    if phone:
        delivery_status, error = _send_sms(phone, sms_body)
        dispatched.append(
            ApplicantNotification.objects.create(
                application=application,
                event=event,
                channel=ApplicantNotification.Channel.SMS,
                recipient=phone,
                subject=subject,
                body=sms_body,
                status=delivery_status,
                error_message=error,
                triggered_by=actor,
            )
        )

    email = (application.email or "").strip()
    if email:
        delivery_status, error = _send_email(email, subject, email_body)
        dispatched.append(
            ApplicantNotification.objects.create(
                application=application,
                event=event,
                channel=ApplicantNotification.Channel.EMAIL,
                recipient=email,
                subject=subject,
                body=email_body,
                status=delivery_status,
                error_message=error,
                triggered_by=actor,
            )
        )

    if dispatched and actor:
        channels = ", ".join(
            f"{n.get_channel_display()} ({n.recipient})" for n in dispatched
        )
        event_label = dict(ApplicantNotification.Event.choices).get(event, event)
        Activity.objects.create(
            application=application,
            actor=actor,
            verb=Activity.Verb.NOTIFIED,
            message=f"{event_label} notification sent via {channels}",
            meta={
                "event": event,
                "channels": [n.channel for n in dispatched],
                "notification_ids": [n.pk for n in dispatched],
            },
        )

    return dispatched


def _notify_farmer_by_ids(application_id: int, event: str, actor_id: int | None) -> None:
    from accounts.models import User

    application = LandApplication.objects.filter(pk=application_id).first()
    if not application:
        return
    actor = User.objects.filter(pk=actor_id).first() if actor_id else None
    notify_farmer(application, event, actor=actor)


def notify_farmer_async(
    application: LandApplication,
    event: str,
    actor=None,
) -> None:
    """
    Non-blocking wrapper around `notify_farmer` that schedules SMS & Email
    dispatch via `transaction.on_commit` onto a background worker thread.
    Ensures HTTP responses never block on Android Wi-Fi or SMTP network I/O.
    """
    app_id = application.pk
    actor_id = getattr(actor, "pk", None)
    run_after_commit_async(_notify_farmer_by_ids, app_id, event, actor_id)

