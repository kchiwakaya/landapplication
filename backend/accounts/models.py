from django.contrib.auth.models import AbstractUser
from django.db import models

from applications.constants import Province


class Role(models.TextChoices):
    """
    Roles map onto the sections of the A2 application form:

    * CAPTURE_OFFICER  - receives and captures sections A-C plus attachments.
    * LAND_OFFICER     - Provincial Chief Land Officer, Section D comments.
    * COMMITTEE        - Land Identification & Resettlement Committee, Section E.
    * BOARD            - Agricultural Land Settlement Board, Section F.
    * MINISTER         - Minister's office, Section G final decision.
    * ADMIN            - system administrator; may act at any stage.
    """

    CAPTURE_OFFICER = "capture_officer", "Capture Officer"
    LAND_OFFICER = "land_officer", "Chief Land Officer"
    COMMITTEE = "committee", "Resettlement Committee"
    BOARD = "board", "Land Settlement Board"
    MINISTER = "minister", "Minister's Office"
    ADMIN = "admin", "Administrator"


# Roles whose visibility is limited to their own province.
PROVINCIAL_ROLES = {Role.CAPTURE_OFFICER, Role.LAND_OFFICER, Role.COMMITTEE}


class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.CAPTURE_OFFICER)
    province = models.CharField(
        max_length=32,
        choices=Province.choices,
        blank=True,
        help_text="Required for provincial roles; leave blank for national roles.",
    )
    employee_number = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return self.get_full_name() or self.username

    @property
    def is_admin(self) -> bool:
        return self.is_superuser or self.role == Role.ADMIN

    @property
    def is_provincial(self) -> bool:
        return not self.is_admin and self.role in PROVINCIAL_ROLES and bool(self.province)

