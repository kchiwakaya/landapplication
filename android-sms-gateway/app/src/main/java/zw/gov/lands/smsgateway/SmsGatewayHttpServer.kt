package zw.gov.lands.smsgateway

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Embedded HTTP server listening on port 8080 inside SmsGatewayForegroundService.
 *
 * Endpoints:
 *   - GET  /health    -> Returns JSON health & sent count
 *   - POST /send-sms  -> Validates X-Gateway-Token header and dispatches physical SIM SMS
 */
class SmsGatewayHttpServer(
    private val appContext: Context,
    port: Int = PORT
) : NanoHTTPD(port) {

    companion object {
        const val PORT = 8080
        private const val MIME_JSON = "application/json; charset=utf-8"
    }

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri ?: "/"
        val method = session.method

        // 1. Healthcheck endpoint
        if (method == Method.GET && (uri == "/health" || uri == "/")) {
            val payload = JSONObject().apply {
                put("status", "ok")
                put("service", "Ministry-Android-SMS-Gateway")
                put("ip", GatewayRepository.resolveLocalIpAddress())
                put("port", PORT)
                put("sent_count", GatewayRepository.sentCount.value)
            }
            return jsonResponse(Response.Status.OK, payload)
        }

        // 2. Dispatch endpoint
        if (method == Method.POST && (uri == "/send-sms" || uri == "/")) {
            return handleSendSms(session)
        }

        return jsonError(Response.Status.NOT_FOUND, "Endpoint not found. Use POST /send-sms")
    }

    private fun handleSendSms(session: IHTTPSession): Response {
        // Validate X-Gateway-Token (or Authorization: Bearer <token>) in constant time
        val expectedSecret = GatewayRepository.secretToken.value
        val headerToken = extractToken(session.headers)

        if (expectedSecret.isBlank() || !constantTimeEquals(expectedSecret, headerToken)) {
            GatewayRepository.appendLog(
                SmsLogEntry(
                    phoneNumber = session.remoteIpAddress ?: "unknown-ip",
                    message = "Rejected request with invalid or missing X-Gateway-Token",
                    status = LogStatus.UNAUTHORIZED,
                    detail = "HTTP 401 Unauthorized"
                )
            )
            return jsonError(Response.Status.UNAUTHORIZED, "Invalid or missing X-Gateway-Token header.")
        }

        // Verify SEND_SMS runtime permission is granted on the device
        val hasSmsPermission = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.SEND_SMS
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasSmsPermission) {
            GatewayRepository.appendLog(
                SmsLogEntry(
                    phoneNumber = "N/A",
                    message = "SEND_SMS permission not granted on Android device",
                    status = LogStatus.FAILED,
                    detail = "Grant SEND_SMS permission in app UI"
                )
            )
            return jsonError(
                Response.Status.INTERNAL_ERROR,
                "SEND_SMS runtime permission is not granted on the Android phone."
            )
        }

        // Parse request body
        val bodyMap = HashMap<String, String>()
        try {
            session.parseBody(bodyMap)
        } catch (exc: Exception) {
            return jsonError(Response.Status.BAD_REQUEST, "Failed to read request body: ${exc.message}")
        }

        val rawBody = bodyMap["postData"]?.trim().orEmpty()
        if (rawBody.isEmpty()) {
            return jsonError(Response.Status.BAD_REQUEST, "Empty JSON request body.")
        }

        val json = try {
            JSONObject(rawBody)
        } catch (exc: Exception) {
            return jsonError(Response.Status.BAD_REQUEST, "Malformed JSON payload: ${exc.message}")
        }

        val phoneNumber = json.optString("phone_number")
            .ifBlank { json.optString("to") }
            .trim()
        val message = json.optString("message").trim()

        if (phoneNumber.isBlank()) {
            return jsonError(Response.Status.BAD_REQUEST, "Field 'phone_number' (or 'to') is required.")
        }
        if (message.isBlank()) {
            return jsonError(Response.Status.BAD_REQUEST, "Field 'message' is required.")
        }

        return try {
            val smsManager = resolveSmsManager()
            val parts = smsManager.divideMessage(message)

            if (parts.size > 1) {
                smsManager.sendMultipartTextMessage(
                    phoneNumber,
                    null,
                    parts,
                    null,
                    null
                )
            } else {
                smsManager.sendTextMessage(
                    phoneNumber,
                    null,
                    message,
                    null,
                    null
                )
            }

            GatewayRepository.appendLog(
                SmsLogEntry(
                    phoneNumber = phoneNumber,
                    message = message,
                    partsCount = parts.size,
                    status = LogStatus.SENT,
                    detail = "Dispatched via physical SIM (${parts.size} part${if (parts.size == 1) "" else "s"})"
                )
            )

            val responseJson = JSONObject().apply {
                put("status", "sent")
                put("phone_number", phoneNumber)
                put("parts", parts.size)
            }
            jsonResponse(Response.Status.OK, responseJson)
        } catch (exc: Exception) {
            GatewayRepository.appendLog(
                SmsLogEntry(
                    phoneNumber = phoneNumber,
                    message = message,
                    status = LogStatus.FAILED,
                    detail = exc.message ?: exc.javaClass.simpleName
                )
            )
            jsonError(
                Response.Status.INTERNAL_ERROR,
                "SmsManager failed to send SMS: ${exc.message ?: exc.javaClass.simpleName}"
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun resolveSmsManager(): SmsManager {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            appContext.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
        } else {
            SmsManager.getDefault()
        }
    }

    private fun extractToken(headers: Map<String, String>?): String {
        if (headers == null) return ""
        // NanoHTTPD lowercases incoming header keys
        val direct = headers["x-gateway-token"] ?: headers["X-Gateway-Token"]
        if (!direct.isNullOrBlank()) {
            return direct.trim()
        }
        val auth = headers["authorization"] ?: headers["Authorization"]
        if (!auth.isNullOrBlank() && auth.startsWith("Bearer ", ignoreCase = true)) {
            return auth.substring(7).trim()
        }
        return ""
    }

    private fun constantTimeEquals(expected: String, actual: String): Boolean {
        return MessageDigest.isEqual(
            expected.toByteArray(Charsets.UTF_8),
            actual.toByteArray(Charsets.UTF_8)
        )
    }

    private fun jsonResponse(status: Response.Status, body: JSONObject): Response {
        return newFixedLengthResponse(status, MIME_JSON, body.toString())
    }

    private fun jsonError(status: Response.Status, message: String): Response {
        val err = JSONObject().apply {
            put("status", "error")
            put("error", message)
        }
        return jsonResponse(status, err)
    }
}

