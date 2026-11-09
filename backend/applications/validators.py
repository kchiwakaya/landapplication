import os

from django.conf import settings
from django.core.exceptions import ValidationError

# Leading bytes of the file types we accept. Extensions alone are not trusted.
_SIGNATURES = {
    "pdf": [b"%PDF"],
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
}

CONTENT_TYPES = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
}


def validate_attachment(upload) -> str:
    """Validate an uploaded file and return its canonical content type."""
    ext = os.path.splitext(upload.name)[1].lower().lstrip(".")
    allowed = settings.ATTACHMENT_ALLOWED_EXTENSIONS
    if ext not in allowed:
        raise ValidationError(f"Unsupported file type. Allowed: {', '.join(allowed).upper()}.")

    max_bytes = settings.ATTACHMENT_MAX_MB * 1024 * 1024
    if upload.size > max_bytes:
        raise ValidationError(f"File is larger than {settings.ATTACHMENT_MAX_MB} MB.")
    if upload.size == 0:
        raise ValidationError("File is empty.")

    head = upload.read(16)
    upload.seek(0)
    if not any(head.startswith(sig) for sig in _SIGNATURES[ext]):
        raise ValidationError("File contents do not match its extension.")

    return CONTENT_TYPES[ext]

