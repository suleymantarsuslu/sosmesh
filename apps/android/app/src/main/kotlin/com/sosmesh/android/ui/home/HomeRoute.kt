package com.sosmesh.android.ui.home

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.sosmesh.android.R
import com.sosmesh.android.service.MeshConnectionForegroundService

@Composable
fun HomeRoute(onOpenPermissions: () -> Unit) {
    val context = LocalContext.current
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(text = stringResource(R.string.home_title), style = MaterialTheme.typography.headlineMedium)
        Text(
            text = stringResource(com.sosmesh.android.core.permissions.R.string.permission_disclaimer_not112),
            style = MaterialTheme.typography.bodyMedium,
        )
        Button(onClick = onOpenPermissions) {
            Text(stringResource(R.string.home_permissions_cta))
        }
        Button(
            onClick = {
                context.startForegroundService(
                    Intent(context, MeshConnectionForegroundService::class.java),
                )
            },
        ) {
            Text(stringResource(R.string.home_start_relay))
        }
    }
}
