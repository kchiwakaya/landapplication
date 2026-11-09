"""
Create demo officer accounts (one per role) and a set of sample applications.

    python manage.py seed_demo            # officers + 40 sample applications
    python manage.py seed_demo --count 0  # officers only
"""
import random
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from applications import workflow
from applications.constants import (
    DISTRICTS,
    AttachmentType,
    FarmingType,
    FarmType,
    MaritalStatus,
    Outcome,
    Province,
    Sex,
    Source,
    Title,
)
from applications.models import Activity, ApplicantNotification, Attachment, LandApplication
from applications.notifications import notify_farmer

PASSWORD = "Lands@2026"

OFFICERS = [
    ("admin", "Tendai", "Moyo", Role.ADMIN, ""),
    ("capture", "Rutendo", "Chikwanha", Role.CAPTURE_OFFICER, ""),
    ("clo", "Farai", "Mutasa", Role.LAND_OFFICER, ""),
    ("committee", "Nyasha", "Gumbo", Role.COMMITTEE, ""),
    ("board", "Tafadzwa", "Ncube", Role.BOARD, ""),
    ("minister", "Chipo", "Dube", Role.MINISTER, ""),
]

SURNAMES = [
    "Mapfumo", "Ndlovu", "Sibanda", "Chiweshe", "Marufu", "Mlambo", "Zvobgo", "Nyathi",
    "Mhlanga", "Banda", "Chimuka", "Matongo", "Mukwena", "Shumba", "Mpofu", "Gatsi",
]
MALE_NAMES = ["Tinashe", "Tapiwa", "Kudakwashe", "Blessing", "Simba", "Takudzwa", "Themba"]
FEMALE_NAMES = ["Rumbidzai", "Vimbai", "Tsitsi", "Nokuthula", "Ruvimbo", "Chiedza", "Thandiwe"]
OCCUPATIONS = [
    "Agronomist", "Teacher", "Civil servant", "Retired soldier", "Accountant",
    "Extension officer", "Businessperson", "Nurse", "Engineer", "Farmer",
]

# Smallest valid PDF so attachments open correctly in the viewer.
SAMPLE_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n"
    b"trailer<</Root 1 0 R>>\n%%EOF\n"
)


class Command(BaseCommand):
    help = "Seed demo officers and sample land applications."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=40)

    @transaction.atomic
    def handle(self, *args, count, **options):
        officers = {}
        for username, first, last, role, province in OFFICERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults=dict(
                    first_name=first, last_name=last, role=role, province=province,
                    email=f"{username}@lands.gov.zw",
                    is_staff=role == Role.ADMIN, is_superuser=role == Role.ADMIN,
                ),
            )
            if created:
                user.set_password(PASSWORD)
                user.save()
            officers[role] = user
        self.stdout.write(self.style.SUCCESS(f"Officers ready (password: {PASSWORD})"))

        if count <= 0 or LandApplication.objects.exists():
            return

        rng = random.Random(42)
        today = timezone.localdate()
        capture = officers[Role.CAPTURE_OFFICER]
        for i in range(count):
            sex = rng.choice([Sex.MALE, Sex.FEMALE])
            first = rng.choice(MALE_NAMES if sex == Sex.MALE else FEMALE_NAMES)
            surname = rng.choice(SURNAMES)
            pref_province = rng.choice(list(Province))
            received = today - timedelta(days=rng.randint(0, 330))
            title = Title.MR if sex == Sex.MALE else rng.choice([Title.MRS, Title.MISS])
            app = LandApplication.objects.create(
                province=pref_province,
                source=Source.ONLINE,
                date_received=received,
                title=title,
                surname=surname,
                other_names=first,
                sex=sex,
                marital_status=rng.choice(list(MaritalStatus)),
                national_id=f"{rng.randint(10, 80)}-{rng.randint(100000, 9999999)}"
                            f"{rng.choice('ABCDEFGHJKLMNPRSTVWXYZ')}{rng.randint(10, 99)}",
                residential_address=f"{rng.randint(1, 900)} Main Road, Marondera",
                postal_address=f"P.O. Box {rng.randint(10, 999)}, Marondera",
                mobile_phone=f"+263 77 {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                occupation=rng.choice(OCCUPATIONS),
                preferred_province=pref_province,
                preferred_district=rng.choice(DISTRICTS[pref_province]),
                farm_type=rng.choice(list(FarmType)),
                farming_type=rng.choice([FarmingType.CROPS, FarmingType.LIVESTOCK, FarmingType.MIXED]),
                declaration_name=f"{first} {surname}",
                declaration_date=received,
                declaration_signed=True,
                created_by=capture,
            )
            Activity.objects.create(
                application=app, actor=capture, verb=Activity.Verb.CREATED,
                to_status=app.status, message="Captured from seed data",
            )
            notify_farmer(app, ApplicantNotification.Event.RECEIVED, actor=capture)
            for doc in (AttachmentType.NATIONAL_ID, AttachmentType.CASH_FLOW):
                if rng.random() < 0.85:
                    att = Attachment(
                        application=app, doc_type=doc, original_name=f"{doc}.pdf",
                        content_type="application/pdf", size=len(SAMPLE_PDF), uploaded_by=capture,
                    )
                    att.file.save(f"{doc}.pdf", ContentFile(SAMPLE_PDF), save=False)
                    att.save()

            # Walk some applications through the workflow.
            depth = rng.choice([0, 0, 1, 1, 2, 3, 4])
            chain = [Role.LAND_OFFICER, Role.COMMITTEE, Role.BOARD, Role.MINISTER]
            for role in chain[:depth]:
                if app.missing_required_attachments:
                    break
                outcome = Outcome.POSITIVE if rng.random() < 0.8 else Outcome.NEGATIVE
                workflow.record_decision(app, officers[role], {
                    "outcome": outcome,
                    "comments": "Reviewed and assessed against Schedule I.",
                    "meeting_date": received + timedelta(days=14),
                    "decision_date": min(today, received + timedelta(days=7 * (chain.index(role) + 1))),
                })
                app.refresh_from_db()
                if app.status == "rejected":
                    break

        self.stdout.write(self.style.SUCCESS(f"Created {count} sample applications."))

