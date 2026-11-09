"""
Reference data for the Land Reform and Resettlement Programme (Phase II, Model A2)
Commercial Farm Settlement Scheme application form.
"""
from django.db import models


class Province(models.TextChoices):
    BULAWAYO = "bulawayo", "Bulawayo"
    HARARE = "harare", "Harare"
    MANICALAND = "manicaland", "Manicaland"
    MASH_CENTRAL = "mashonaland_central", "Mashonaland Central"
    MASH_EAST = "mashonaland_east", "Mashonaland East"
    MASH_WEST = "mashonaland_west", "Mashonaland West"
    MASVINGO = "masvingo", "Masvingo"
    MAT_NORTH = "matabeleland_north", "Matabeleland North"
    MAT_SOUTH = "matabeleland_south", "Matabeleland South"
    MIDLANDS = "midlands", "Midlands"


PROVINCE_CODES = {
    Province.BULAWAYO: "BYO",
    Province.HARARE: "HRE",
    Province.MANICALAND: "MAN",
    Province.MASH_CENTRAL: "MSC",
    Province.MASH_EAST: "MSE",
    Province.MASH_WEST: "MSW",
    Province.MASVINGO: "MSV",
    Province.MAT_NORTH: "MTN",
    Province.MAT_SOUTH: "MTS",
    Province.MIDLANDS: "MID",
}

DISTRICTS = {
    Province.BULAWAYO: ["Bulawayo"],
    Province.HARARE: ["Harare", "Chitungwiza", "Epworth"],
    Province.MANICALAND: [
        "Buhera", "Chimanimani", "Chipinge", "Makoni", "Mutare", "Mutasa", "Nyanga",
    ],
    Province.MASH_CENTRAL: [
        "Bindura", "Guruve", "Mazowe", "Mbire", "Mount Darwin", "Muzarabani",
        "Rushinga", "Shamva",
    ],
    Province.MASH_EAST: [
        "Chikomba", "Goromonzi", "Hwedza", "Marondera", "Mudzi", "Murehwa",
        "Mutoko", "Seke", "Uzumba-Maramba-Pfungwe",
    ],
    Province.MASH_WEST: [
        "Chegutu", "Hurungwe", "Kariba", "Makonde", "Mhondoro-Ngezi", "Sanyati", "Zvimba",
    ],
    Province.MASVINGO: ["Bikita", "Chiredzi", "Chivi", "Gutu", "Masvingo", "Mwenezi", "Zaka"],
    Province.MAT_NORTH: ["Binga", "Bubi", "Hwange", "Lupane", "Nkayi", "Tsholotsho", "Umguza"],
    Province.MAT_SOUTH: [
        "Beitbridge", "Bulilima", "Gwanda", "Insiza", "Mangwe", "Matobo", "Umzingwane",
    ],
    Province.MIDLANDS: [
        "Chirumhanzu", "Gokwe North", "Gokwe South", "Gweru", "Kwekwe", "Mberengwa",
        "Shurugwi", "Zvishavane",
    ],
}


class Title(models.TextChoices):
    MR = "mr", "Mr"
    MRS = "mrs", "Mrs"
    MISS = "miss", "Miss"
    MS = "ms", "Ms"
    DR = "dr", "Dr"


class Sex(models.TextChoices):
    MALE = "male", "Male"
    FEMALE = "female", "Female"


class MaritalStatus(models.TextChoices):
    MARRIED = "married", "Married"
    DIVORCED = "divorced", "Divorced"
    WIDOWED = "widowed", "Widowed"
    SINGLE = "single", "Single"


class FarmType(models.TextChoices):
    SMALL = "small", "Small-scale Commercial Settlement"
    MEDIUM = "medium", "Medium-scale Commercial Settlement"
    LARGE = "large", "Large-scale Commercial Settlement"
    PERI_URBAN = "peri_urban", "Peri-urban Commercial Settlement"


class FarmingType(models.TextChoices):
    CROPS = "crops", "Crops"
    LIVESTOCK = "livestock", "Livestock"
    MIXED = "mixed", "Crops & Livestock"
    OTHER = "other", "Other"


class ApplicantCategory(models.TextChoices):
    """Notes, item 2 - categories the scheme is explicitly open to."""

    WAR_VETERAN = "war_veteran", "War veteran"
    FORMER_DETAINEE = "former_detainee", "Former detainee / restrictee"
    DISABLED = "disabled", "Person with disability"
    PUBLIC_SECTOR = "public_sector", "Public sector employee"
    PRIVATE_SECTOR = "private_sector", "Private sector"


class Source(models.TextChoices):
    WALK_IN = "walk_in", "Walk-in (paper form)"
    POST = "post", "Post"
    EMAIL = "email", "Email"
    ONLINE = "online", "Online"


class NaturalRegion(models.TextChoices):
    I = "I", "Region I"
    IIA = "IIa", "Region IIa"
    IIB = "IIb", "Region IIb"
    III = "III", "Region III"
    IV = "IV", "Region IV"
    V = "V", "Region V"


# Schedule I - recommended farm sizes (hectares) by natural agro-ecological zone.
FARM_SIZE_SCHEDULE = [
    {"region": "I", "small": "15 – 25", "medium": "100", "large": "250"},
    {"region": "IIa", "small": "25 – 40", "medium": "200", "large": "350"},
    {"region": "IIb", "small": "40 – 50", "medium": "250", "large": "400"},
    {"region": "III", "small": "60 – 80", "medium": "300", "large": "500"},
    {"region": "IV", "small": "150 – 200", "medium": "700", "large": "1 500"},
    {"region": "V", "small": "250 – 350", "medium": "1 500", "large": "2 000"},
]
PERI_URBAN_SIZE = "15 – 50"


class Status(models.TextChoices):
    RECEIVED = "received", "Received"
    QUERIED = "queried", "Queried"
    COMMITTEE = "committee", "With Committee"
    BOARD = "board", "With Board"
    MINISTER = "minister", "With Minister"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn"


FINAL_STATUSES = {Status.APPROVED, Status.REJECTED, Status.WITHDRAWN}
EDITABLE_STATUSES = {Status.RECEIVED, Status.QUERIED}


class Stage(models.TextChoices):
    """Sections D-G of the form ('For official use only')."""

    LAND_OFFICER = "D", "Chief Land Officer comments"
    COMMITTEE = "E", "Land Identification & Resettlement Committee"
    BOARD = "F", "Agricultural Land Settlement Board"
    MINISTER = "G", "Minister of Lands and Rural Development"


class Outcome(models.TextChoices):
    POSITIVE = "positive", "Positive"
    NEGATIVE = "negative", "Negative"
    QUERY = "query", "Query"


# Stage-specific wording used on the paper form.
OUTCOME_LABELS = {
    Stage.LAND_OFFICER: {"positive": "Supported", "negative": "Not supported", "query": "Query"},
    Stage.COMMITTEE: {"positive": "Approve", "negative": "Reject"},
    Stage.BOARD: {"positive": "Recommended", "negative": "Not recommended"},
    Stage.MINISTER: {"positive": "Approved", "negative": "Not approved"},
}


class AttachmentType(models.TextChoices):
    NATIONAL_ID = "national_id", "National ID"
    CASH_FLOW = "cash_flow", "Five-year cash flow projection"
    TRAINING = "training", "Proof of training / experience"
    FUNDS = "funds", "Proof of funds / movable assets"
    WAR_VETERAN = "war_veteran", "War veteran / detainee certificate"
    MARRIAGE = "marriage", "Marriage certificate"
    SIGNED_FORM = "signed_form", "Signed application form"
    SUPPORTING = "supporting", "Additional sheet / supporting document"
    OTHER = "other", "Other"


# Documents that must be on file before the Chief Land Officer can forward
# the application to the Committee (Notes, item 5 & Section B, item 7).
REQUIRED_ATTACHMENTS = [AttachmentType.NATIONAL_ID, AttachmentType.CASH_FLOW]

