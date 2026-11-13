"""
Android Physical-SIM SMS Gateway client and non-blocking dispatch utilities.

Communicates with the local Android Foreground Service HTTP server (port 8080)
authenticated via the `X-Gateway-Token` header (`settings.SMS_GATEWAY_SECRET_KEY`).

Includes:
  - `AndroidSmsGatewayClient`: `requests.Session`-backed HTTP client with
    connection/read timeouts, transient retry policy, and structured logging.
  - `send_sms_via_android_gateway`: Synchronous helper returning `SmsDispatchResult`.
  - `dispatch_sms_async` & `run_after_commit_async`: Non-blocking wrappers using
    `django.db.transaction.on_commit` + a background thread pool so SMS/Email
    network I/O never blocks HTTP request/response cycles.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable

import requests
from django.conf import settings
from django.db import close_old_connections, transaction
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Bounded background worker pool so slow Wi-Fi / GSM handshakes on the Android
# device never block Gunicorn request threads.
_SMS_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="android-sms-gw")


@dataclass(frozen=True)
class SmsDispatchResult:
    success: bool
    status_code: int | None = None
    error_message: str = ""
    simulated: bool = False
    response_payload: dict[str, Any] = field(default_factory=dict)


class AndroidSmsGatewayClient:
    """
    Production HTTP client for dispatching SMS messages through an Android phone
    running the companion Foreground Service gateway.
    """

    def __init__(
        self,
        gateway_url: str | None = None,
        secret_key: str | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        raw_url = (
            gateway_url
            if gateway_url is not None
            else getattr(settings, "ANDROID_SMS_GATEWAY_URL", "")
            or getattr(settings, "SMS_GATEWAY_URL", "")
        )
        self.gateway_url: str = raw_url.strip()

        raw_secret = (
            secret_key
            if secret_key is not None
            else getattr(settings, "SMS_GATEWAY_SECRET_KEY", "")
            or getattr(settings, "SMS_GATEWAY_API_KEY", "")
        )
        self.secret_key: str = raw_secret.strip()

        self.timeout_seconds: float = float(
            timeout_seconds
            if timeout_seconds is not None
            else getattr(settings, "SMS_GATEWAY_TIMEOUT_SECONDS", 8.0)
        )
        self._session = self._build_session()

    @staticmethod
    def _build_session() -> requests.Session:
        session = requests.Session()
        retry = Retry(
            total=2,
            connect=2,
            read=0,  # Do not retry POST after read started to prevent duplicate SMS
            status=1,
            status_forcelist=(502, 503, 504),
            allowed_methods=frozenset(["POST", "GET"]),
            backoff_factor=0.4,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=4, pool_maxsize=8)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session

    def send_sms(self, phone_number: str, message: str) -> SmsDispatchResult:
        """
        POST an SMS payload to the Android gateway device.

        Expected Android Gateway request contract:
          POST <ANDROID_SMS_GATEWAY_URL> (e.g. http://192.168.1.50:8080/send-sms)
          Headers:
            Content-Type: application/json
            X-Gateway-Token: <SMS_GATEWAY_SECRET_KEY>
          Body:
            {
              "phone_number": "+263771234567",
              "to": "+263771234567",
              "from": "MIN-LANDS",
              "message": "MINISTRY OF LANDS: ..."
            }
        """
        recipient = (phone_number or "").strip()
        body = (message or "").strip()

        if not recipient:
            return SmsDispatchResult(
                success=False,
                error_message="Recipient phone number is empty.",
            )
        if not body:
            return SmsDispatchResult(
                success=False,
                error_message="SMS message body is empty.",
            )

        # Development / unconfigured fallback: log locally so workflow continues cleanly
        if not self.gateway_url:
            logger.info(
                "ANDROID_SMS_GATEWAY_URL not configured; logging SMS locally [%s]: %s",
                recipient,
                body,
            )
            return SmsDispatchResult(
                success=True,
                status_code=200,
                simulated=True,
                response_payload={"status": "simulated", "phone_number": recipient},
            )

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Gateway-Token": self.secret_key,
        }
        if self.secret_key:
            headers["Authorization"] = f"Bearer {self.secret_key}"

        payload = {
            "phone_number": recipient,
            "to": recipient,
            "from": getattr(settings, "SMS_SENDER_ID", "MIN-LANDS"),
            "message": body,
        }

        connect_timeout = min(3.5, self.timeout_seconds)
        read_timeout = max(3.5, self.timeout_seconds)

        try:
            response = self._session.post(
                self.gateway_url,
                json=payload,
                headers=headers,
                timeout=(connect_timeout, read_timeout),
            )
            try:
                data = response.json() if response.content else {}
            except ValueError:
                data = {"raw": response.text[:500]}

            if 200 <= response.status_code < 300:
                logger.info(
                    "Android SMS gateway accepted message for %s (HTTP %s)",
                    recipient,
                    response.status_code,
                )
                return SmsDispatchResult(
                    success=True,
                    status_code=response.status_code,
                    response_payload=data if isinstance(data, dict) else {"data": data},
                )

            error_detail = (
                data.get("error") or data.get("detail")
                if isinstance(data, dict)
                else None
            ) or f"Gateway HTTP {response.status_code}"
            logger.warning(
                "Android SMS gateway rejected message for %s (HTTP %s): %s",
                recipient,
                response.status_code,
                error_detail,
            )
            return SmsDispatchResult(
                success=False,
                status_code=response.status_code,
                error_message=str(error_detail),
                response_payload=data if isinstance(data, dict) else {},
            )

        except requests.Timeout as exc:
            msg = f"Android SMS gateway timed out after {self.timeout_seconds}s ({exc})"
            logger.warning("SMS timeout for %s: %s", recipient, msg)
            return SmsDispatchResult(success=False, error_message=msg)
        except requests.ConnectionError as exc:
            msg = f"Cannot reach Android SMS gateway at {self.gateway_url} ({exc})"
            logger.warning("SMS connection error for %s: %s", recipient, msg)
            return SmsDispatchResult(success=False, error_message=msg)
        except requests.RequestException as exc:
            msg = f"Android SMS gateway request failed: {exc}"
            logger.warning("SMS request exception for %s: %s", recipient, msg)
            return SmsDispatchResult(success=False, error_message=msg)
        except Exception as exc:
            logger.exception("Unexpected error dispatching SMS to %s", recipient)
            return SmsDispatchResult(success=False, error_message=str(exc))


# Module-level singleton client (re-reads settings per call if not overridden)
def send_sms_via_android_gateway(phone_number: str, message: str) -> SmsDispatchResult:
    """Synchronous entry point to send an SMS via the Android Gateway."""
    client = AndroidSmsGatewayClient()
    return client.send_sms(phone_number=phone_number, message=message)


def _background_task_wrapper(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    """
    Execute a callable inside a worker thread while ensuring Django DB
    connections are properly cleaned up before and after execution.
    """
    close_old_connections()
    try:
        fn(*args, **kwargs)
    except Exception:
        logger.exception("Background SMS/notification task failed in %s", fn.__name__)
    finally:
        close_old_connections()


def run_after_commit_async(fn: Callable[..., Any], *args: Any, **kwargs: Any) -> None:
    """
    Schedule `fn(*args, **kwargs)` to run asynchronously in the background
    thread pool *only after* the active database transaction commits.
    If no transaction is active, `on_commit` triggers immediately.
    """
    transaction.on_commit(
        lambda: _SMS_EXECUTOR.submit(_background_task_wrapper, fn, *args, **kwargs)
    )


def dispatch_sms_async(phone_number: str, message: str) -> None:
    """
    Fire-and-forget asynchronous SMS dispatch hooked into `transaction.on_commit`.
    Guarantees HTTP views never block waiting for the Android phone over Wi-Fi.
    """
    run_after_commit_async(send_sms_via_android_gateway, phone_number, message)

