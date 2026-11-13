package zw.gov.lands.smsgateway

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        GatewayRepository.init(applicationContext)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFF8FAFC)
                ) {
                    SmsGatewayScreen()
                }
            }
        }
    }
}

@Composable
fun SmsGatewayScreen() {
    val context = LocalContext.current
    val isRunning by GatewayRepository.isRunning.collectAsState()
    val savedToken by GatewayRepository.secretToken.collectAsState()
    val logs by GatewayRepository.logs.collectAsState()
    val sentCount by GatewayRepository.sentCount.collectAsState()

    var tokenInput by remember(savedToken) { mutableStateOf(savedToken) }
    var localIp by remember { mutableStateOf(GatewayRepository.resolveLocalIpAddress()) }

    // Check SMS permission status
    var hasSmsPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        hasSmsPermission = result[Manifest.permission.SEND_SMS] == true ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED
    }

    // Periodically refresh local Wi-Fi IP & request runtime permissions on first launch
    LaunchedEffect(Unit) {
        val required = mutableListOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            required.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissionLauncher.launch(required.toTypedArray())

        while (true) {
            localIp = GatewayRepository.resolveLocalIpAddress()
            delay(5000)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header Card: Status + Wi-Fi IP + Endpoint URL
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (isRunning) Color(0xFF064E3B) else Color(0xFF1E293B)
            ),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Ministry of Lands — SMS Gateway",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp
                    )
                    Box(
                        modifier = Modifier
                            .background(
                                color = if (isRunning) Color(0xFF10B981) else Color(0xFFEF4444),
                                shape = RoundedCornerShape(50)
                            )
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = if (isRunning) "LISTENING :8080" else "STOPPED",
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "ANDROID_SMS_GATEWAY_URL (copy into Django .env):",
                    color = Color(0xFFCBD5E1),
                    fontSize = 12.sp
                )
                Text(
                    text = "http://$localIp:${SmsGatewayHttpServer.PORT}/send-sms",
                    color = Color(0xFFA7F3D0),
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )

                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Wi-Fi IP: $localIp  •  Dispatched SMS: $sentCount  •  SIM Permission: ${if (hasSmsPermission) "GRANTED" else "MISSING"}",
                    color = Color(0xFFE2E8F0),
                    fontSize = 12.sp
                )
            }
        }

        // Permission warning banner if SEND_SMS is not yet granted
        if (!hasSmsPermission) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2))
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "SEND_SMS permission is required to transmit via SIM.",
                        color = Color(0xFF991B1B),
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    OutlinedButton(
                        onClick = {
                            permissionLauncher.launch(
                                arrayOf(
                                    Manifest.permission.SEND_SMS,
                                    Manifest.permission.READ_PHONE_STATE
                                )
                            )
                        }
                    ) {
                        Text("Grant")
                    }
                }
            }
        }

        // Configuration & Service Control Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = tokenInput,
                    onValueChange = {
                        tokenInput = it
                        GatewayRepository.updateSecretToken(context, it)
                    },
                    label = { Text("X-Gateway-Token (SMS_GATEWAY_SECRET_KEY)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            GatewayRepository.updateSecretToken(context, tokenInput)
                            val intent = Intent(context, SmsGatewayForegroundService::class.java).apply {
                                action = if (isRunning) {
                                    SmsGatewayForegroundService.ACTION_STOP
                                } else {
                                    SmsGatewayForegroundService.ACTION_START
                                }
                            }
                            if (!isRunning && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                context.startForegroundService(intent)
                            } else {
                                context.startService(intent)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isRunning) Color(0xFFDC2626) else Color(0xFF059669)
                        ),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isRunning) "Stop Gateway Service" else "Start Gateway Service")
                    }

                    OutlinedButton(
                        onClick = { localIp = GatewayRepository.resolveLocalIpAddress() }
                    ) {
                        Text("Refresh IP")
                    }
                }
            }
        }

        // Live Dispatched Messages Log Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Live Dispatched Messages (${logs.size})",
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = Color(0xFF0F172A)
            )
            if (logs.isNotEmpty()) {
                TextButton(onClick = { GatewayRepository.clearLogs() }) {
                    Text("Clear Log")
                }
            }
        }

        // Scrolling Log List
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            shape = RoundedCornerShape(12.dp)
        ) {
            if (logs.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No SMS dispatches received yet.\nWaiting for POST /send-sms from Django...",
                        color = Color(0xFF64748B),
                        fontSize = 13.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(logs, key = { it.id }) { entry ->
                        SmsLogRow(entry)
                    }
                }
            }
        }
    }
}

@Composable
private fun SmsLogRow(entry: SmsLogEntry) {
    val badgeColor = when (entry.status) {
        LogStatus.SENT -> Color(0xFF059669)
        LogStatus.FAILED -> Color(0xFFDC2626)
        LogStatus.UNAUTHORIZED -> Color(0xFFD97706)
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8FAFC), RoundedCornerShape(8.dp))
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = entry.phoneNumber,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                color = Color(0xFF0F172A)
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .background(badgeColor, RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = entry.status.name,
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = entry.timestamp,
                    color = Color(0xFF64748B),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = entry.message,
            color = Color(0xFF334155),
            fontSize = 12.sp
        )
        if (entry.detail.isNotBlank()) {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = entry.detail,
                color = Color(0xFF64748B),
                fontSize = 11.sp
            )
        }
    }
}

