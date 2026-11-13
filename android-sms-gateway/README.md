# Ministry of Lands — Android Physical-SIM SMS Gateway

A lightweight native Android application (Kotlin + Jetpack Compose + NanoHTTPD) that turns any Android 7.0+ (API 24+) phone with an active physical SIM card into a local HTTP-to-SMS gateway for the **Ministry of Lands and Rural Development (Model A2)** Django backend.

---

## 1. Architecture Overview

```text
┌───────────────────────────────────────┐        HTTP POST /send-sms (Port 8080)       ┌──────────────────────────────────────┐
│  Django Backend (10.100.7.189)        │ ───────────────────────────────────────────▶ │  Android Phone (Same Wi-Fi / LAN)    │
│  • applications/sms_gateway.py        │    Header: X-Gateway-Token: <secret_key>     │  • SmsGatewayForegroundService       │
│  • transaction.on_commit async pool   │    JSON: {"phone_number": "...",             │  • SmsGatewayHttpServer (NanoHTTPD)  │
│  • applications/notifications.py      │           "message": "..."}                  │  • Android SmsManager (Physical SIM) │
└───────────────────────────────────────┘                                              └──────────────────────────────────────┘
```

---

## 2. Building & Installing on the Android Phone

1. Open the **`android-sms-gateway/`** folder in **Android Studio** (Ladybug / Koala or newer).
2. Enable **Developer Options -> USB Debugging** on the Android phone and connect it via USB.
3. Click **Run ('app')** in Android Studio (or run `./gradlew installDebug`).
4. When the app launches on the phone:
   - Grant the **`SEND_SMS`**, **`READ_PHONE_STATE`**, and **`POST_NOTIFICATIONS`** permissions when prompted.
   - Confirm or edit the **`X-Gateway-Token`** secret (default: `mlrd-android-sms-gateway-secret-2026`).
   - Tap **Start Gateway Service**.
   - Note the green endpoint URL displayed at the top of the screen (for example: `http://10.100.7.215:8080/send-sms`).

> **Tip for 24/7 operation:** On the Android phone, go to **Settings -> Apps -> Ministry SMS Gateway -> Battery** and select **Unrestricted** (disable battery optimization) so Android never suspends the foreground service.

---

## 3. Configuring the Django Backend

In `backend/.env` (or `/opt/landapplication/.env` on `10.100.7.189`), set:

```ini
ANDROID_SMS_GATEWAY_URL=http://<PHONE-WIFI-IP>:8080/send-sms
SMS_GATEWAY_SECRET_KEY=mlrd-android-sms-gateway-secret-2026
SMS_GATEWAY_TIMEOUT_SECONDS=8
SMS_SENDER_ID=MIN-LANDS
```

If running in Docker on `10.100.7.189`, apply the updated `.env` by running:

```bash
cd /opt/landapplication && docker compose up -d
```

---

## 4. Testing End-to-End

### A. Direct curl test to the Android Phone
```bash
curl -X POST http://<PHONE-WIFI-IP>:8080/send-sms \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Token: mlrd-android-sms-gateway-secret-2026" \
  -d '{"phone_number": "+263771234567", "message": "MINISTRY OF LANDS: Test SMS via Android SIM Gateway."}'
```

### B. Via the Django API (`POST /api/sms-gateway/send/`)
Authenticated officers (`admin`, `capture_officer`, `land_officer`) can trigger a synchronous or asynchronous (`async_dispatch: true`) test SMS from Django:

```bash
curl -k -X POST https://land.applications/api/sms-gateway/send/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+263771234567", "message": "Test from Django backend", "async_dispatch": false}'
```

