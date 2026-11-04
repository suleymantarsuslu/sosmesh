package com.sosmesh.android.feature.sos.ui

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.sosmesh.android.core.design.emergency.EmergencyNumberProvider
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.feature.sos.R

@Composable
fun SosSentConfirmationDialog(
    sosId: String,
    onDismiss: () -> Unit,
    onNavigateToStatus: () -> Unit,
) {
    val context = LocalContext.current
    val emergencyNumber = EmergencyNumberProvider.getEmergencyNumber(context)
    var isOnline by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        isOnline = checkNetworkStatus(context)
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = MaterialTheme.shapes.large,
            tonalElevation = 6.dp,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(SosSpacing.md),
                verticalArrangement = Arrangement.spacedBy(SosSpacing.md),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(40.dp),
                    )
                    IconButton(
                        onClick = {
                            onNavigateToStatus()
                            onDismiss()
                        },
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = stringResource(android.R.string.cancel),
                        )
                    }
                }

                Text(
                    text = stringResource(R.string.sos_sent_title),
                    style = MaterialTheme.typography.headlineMedium,
                    modifier = Modifier.semantics { contentDescription = "SOS sent" },
                )

                Column(
                    verticalArrangement = Arrangement.spacedBy(SosSpacing.sm),
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Icon(
                            imageVector =
                                if (isOnline) {
                                    Icons.Default.CheckCircle
                                } else {
                                    Icons.Default.Warning
                                },
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text =
                                stringResource(
                                    if (isOnline) {
                                        R.string.sos_sent_online
                                    } else {
                                        R.string.sos_sent_offline
                                    },
                                ),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }

                    HorizontalDivider()

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
                        verticalAlignment = Alignment.Top,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                        )
                        Text(
                            text = stringResource(R.string.sos_sent_not112, emergencyNumber),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(SosSpacing.xs))

                Button(
                    onClick = {
                        onNavigateToStatus()
                        onDismiss()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.sos_sent_action_ok))
                }

                Button(
                    onClick = {
                        val intent =
                            Intent(Intent.ACTION_DIAL).apply {
                                data = android.net.Uri.parse("tel:$emergencyNumber")
                            }
                        context.startActivity(intent)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                        ),
                ) {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(text = stringResource(R.string.sos_delivered_modal_action_call112, emergencyNumber), modifier = Modifier.padding(start = SosSpacing.xs))
                }
            }
        }
    }
}

private fun checkNetworkStatus(context: Context): Boolean {
    val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}
