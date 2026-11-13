package zw.gov.lands.smsgateway

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import fi.iki.elonen.NanoHTTPD

/**
 * Persistent Foreground Service that keeps the embedded NanoHTTPD server
 * listening on port 8080 and prevents Android Doze / Wi-Fi sleep from
 * dropping incoming HTTP requests from the Django backend.
 */
class SmsGatewayForegroundService : Service() {

    companion object {
        const val ACTION_START = "zw.gov.lands.smsgateway.ACTION_START"
        const val ACTION_STOP = "zw.gov.lands.smsgateway.ACTION_STOP"
        private const val CHANNEL_ID = "ministry_sms_gateway_channel"
        private const val NOTIFICATION_ID = 8080
    }

    private var httpServer: SmsGatewayHttpServer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onCreate() {
        super.onCreate()
        GatewayRepository.init(applicationContext)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopGateway()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        startGateway()
        return START_STICKY
    }

    private fun startGateway() {
        if (httpServer?.isAlive == true) {
            GatewayRepository.setRunning(true)
            return
        }

        acquireLocks()

        try {
            val server = SmsGatewayHttpServer(applicationContext, SmsGatewayHttpServer.PORT)
            server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            httpServer = server
            GatewayRepository.setRunning(true)
        } catch (exc: Exception) {
            GatewayRepository.setRunning(false)
            GatewayRepository.appendLog(
                SmsLogEntry(
                    phoneNumber = "SYSTEM",
                    message = "Failed to bind port ${SmsGatewayHttpServer.PORT}",
                    status = LogStatus.FAILED,
                    detail = exc.message ?: "Port already in use"
                )
            )
        }
    }

    private fun stopGateway() {
        try {
            httpServer?.stop()
        } catch (_: Exception) {
        } finally {
            httpServer = null
            GatewayRepository.setRunning(false)
            releaseLocks()
        }
    }

    private fun acquireLocks() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (wakeLock?.isHeld != true) {
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "MinistrySmsGateway::CpuWakeLock"
                ).apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }

            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            if (wifiLock?.isHeld != true) {
                @Suppress("DEPRECATION")
                val lockMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                } else {
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF
                }
                wifiLock = wm.createWifiLock(lockMode, "MinistrySmsGateway::WifiLock").apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }
        } catch (_: Exception) {
        }
    }

    private fun releaseLocks() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        } catch (_: Exception) {
        }
        try {
            if (wifiLock?.isHeld == true) wifiLock?.release()
        } catch (_: Exception) {
        }
    }

    private fun buildNotification(): Notification {
        val ip = GatewayRepository.resolveLocalIpAddress()
        val openAppIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ministry SMS Gateway Active")
            .setContentText("Listening on http://$ip:${SmsGatewayHttpServer.PORT}/send-sms")
            .setSmallIcon(android.R.drawable.sym_action_email)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Ministry SMS Gateway Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the local HTTP SMS Gateway running on port 8080"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        stopGateway()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

