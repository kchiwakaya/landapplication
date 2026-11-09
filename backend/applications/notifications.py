"""
Farmer (applicant) notification service for the two statutory milestones:
  1. Application received (`application_received`)
  2. Application approved (`application_approved`)

Dispatches SMS (to the applicant's primary phone number) and Email (if an
email address was provided on the form), records each dispatch in
`ApplicantNotification`, and appends an audit trail entry in `Activity`.
"""
import json
import logging
from urllib import request as urllib_request

from django.conf import settings
from django.core.mail import send_mail

from .models import Activity, ApplicantNotification, LandApplication

logger = logging.getLogger(__name__)


def _applicant_phone(app: LandApplication) -> str:
    return (app.mobile_phone or app.residential_phone or app.business_phone or "").strip()


def _compose_received(app: LandApplication) -> tuple[str, str, str]:
    title_name = f"{app.get_title_display()} {app.full_name}"

    sms_body = (
        f"MINISTRY OF LANDS: Dear {title_name}, we have received your application "
        f"(Form No. {app.application_no}) and once land is available you will be notified."
    )

    subject = f"Application Received – Form No. {app.application_no}"
    email_body = (
        f"MINISTRY OF LANDS AND RURAL DEVELOPMENT\n"
        f"Land Reform and Resettlement Programme (Phase II, Model A2)\n"
        f"------------------------------------------------------------\n\n"
        f"Dear {title_name},\n\n"
        f"We have received your application (Application Form No. {app.application_no}) "
        f"and once land is available you will be notified.\n\n"
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
    gateway_url = getattr(settings, "SMS_GATEWAY_URL", "").strip()
    if not gateway_url:
        logger.info("SMS [%s]: %s", recipient, body)
        return ApplicantNotification.DeliveryStatus.SENT, ""

    try:
        payload = json.dumps({
            "to": recipient,
            "from": getattr(settings, "SMS_SENDER_ID", "MIN-LANDS"),
            "message": body,
        }).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        api_key = getattr(settings, "SMS_GATEWAY_API_KEY", "").strip()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        req = urllib_request.Request(gateway_url, data=payload, headers=headers, method="POST")
        with urllib_request.urlopen(req, timeout=8) as resp:  # noqa: S310
            if 200 <= resp.status < 300:
                return ApplicantNotification.DeliveryStatus.SENT, ""
            return ApplicantNotification.DeliveryStatus.FAILED, f"Gateway HTTP {resp.status}"
    except Exception as exc:
        logger.warning("SMS gateway error for %s: %s", recipient, exc)
        return ApplicantNotification.DeliveryStatus.FAILED, str(exc)


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
