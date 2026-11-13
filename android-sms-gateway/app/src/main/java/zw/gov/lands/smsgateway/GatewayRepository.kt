package zw.gov.lands.smsgateway

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.net.Inet4Address
import java.net.NetworkInterface
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

enum class LogStatus {
    SENT,
    FAILED,
    UNAUTHORIZED
}

data class SmsLogEntry(
    val id: String = UUID.randomUUID().toString(),
    val timestamp: String = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date()),
    val phoneNumber: String,
    val message: String,
    val partsCount: Int = 1,
    val status: LogStatus,
    val detail: String = ""
)

/**
 * Thread-safe singleton state repository shared between the Foreground Service,
 * NanoHTTPD worker threads, and the Jetpack Compose UI.
 */
object GatewayRepository {
    private const val PREFS_NAME = "ministry_sms_gateway_prefs"
    private const val KEY_SECRET_TOKEN = "secret_token"
    private const val DEFAULT_SECRET = "mlrd-android-sms-gateway-secret-2026"
    private const val MAX_LOG_ENTRIES = 200

    private val _isRunning = MutableStateFlow(false)
    val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

    private val _secretToken = MutableStateFlow(DEFAULT_SECRET)
    val secretToken: StateFlow<String> = _secretToken.asStateFlow()

    private val _logs = MutableStateFlow<List<SmsLogEntry>>(emptyList())
    val logs: StateFlow<List<SmsLogEntry>> = _logs.asStateFlow()

    private val _sentCount = MutableStateFlow(0)
    val sentCount: StateFlow<Int> = _sentCount.asStateFlow()

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY_SECRET_TOKEN, null)
        if (!saved.isNullOrBlank()) {
            _secretToken.value = saved
        }
    }

    fun updateSecretToken(context: Context, newToken: String) {
        val trimmed = newToken.trim()
        _secretToken.value = trimmed
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SECRET_TOKEN, trimmed)
            .apply()
    }

    fun setRunning(running: Boolean) {
        _isRunning.value = running
    }

    fun appendLog(entry: SmsLogEntry) {
        if (entry.status == LogStatus.SENT) {
            _sentCount.update { it + 1 }
        }
        _logs.update { current ->
            (listOf(entry) + current).take(MAX_LOG_ENTRIES)
        }
    }

    fun clearLogs() {
        _logs.value = emptyList()
    }

    /**
     * Resolves the phone's current LAN IPv4 address (prefers wlan0 / eth0).
     */
    fun resolveLocalIpAddress(): String {
        return try {
            val interfaces = NetworkInterface.getNetworkInterfaces()?.toList().orEmpty()
            val candidates = mutableListOf<Pair<String, String>>()

            for (iface in interfaces) {
                if (!iface.isUp || iface.isLoopback) continue
                for (addr in iface.inetAddresses) {
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        candidates.add(iface.name.lowercase(Locale.ROOT) to ip)
                    }
                }
            }

            // Prefer Wi-Fi (wlan*) or Ethernet (eth*) over cellular rmnet* interfaces
            candidates.firstOrNull { it.first.startsWith("wlan") }?.second
                ?: candidates.firstOrNull { it.first.startsWith("eth") }?.second
                ?: candidates.firstOrNull()?.second
                ?: "0.0.0.0"
        } catch (_: Exception) {
            "0.0.0.0"
        }
    }
}

