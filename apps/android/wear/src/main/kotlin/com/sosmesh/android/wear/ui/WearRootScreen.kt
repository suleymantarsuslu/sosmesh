package com.sosmesh.android.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.components.SosMeshLogo
import com.sosmesh.android.core.design.theme.SosBrandColors
import com.sosmesh.android.core.design.theme.SosSpacing
import com.sosmesh.android.wear.R
import kotlinx.coroutines.delay

@Composable
fun WearRootScreen(viewModel: WearSosViewModel) {
    LaunchedEffect(Unit) {
        while (true) {
            viewModel.refreshStatus()
            delay(2_000)
        }
    }

    when (viewModel.confirmStep) {
        WearConfirmStep.CONFIRM_DIALOG -> ConfirmDialog(viewModel)
        WearConfirmStep.CANCELLED -> StatusPanel(viewModel, accent = SosBrandColors.NavyMuted)
        else -> SosHome(viewModel, viewModel.isAmbientMode)
    }
}

@Composable
private fun SosHome(
    viewModel: WearSosViewModel,
    isAmbient: Boolean,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(SosSpacing.xs),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (!isAmbient) {
            SosMeshLogo(
                modifier = Modifier.testTag("wear_sosmesh_logo"),
                size = 40.dp,
            )
        }
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(WearAmbientUiPolicy.sosBackground(isAmbient))
                    .then(
                        if (isAmbient) {
                            Modifier
                        } else {
                            Modifier.pointerInput(Unit) {
                                detectTapGestures(
                                    onPress = {
                                        viewModel.onSosPressStart()
                                        tryAwaitRelease()
                                        viewModel.onSosPressRelease()
                                    },
                                )
                            }
                        },
                    )
                    .semantics { contentDescription = "SOS acil gönderim alanı" }
                    .testTag("wear_sos_touch_target"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "SOS",
                color = WearAmbientUiPolicy.primaryText(isAmbient),
                style = MaterialTheme.typography.titleLarge,
            )
        }
        Text(
            text = viewModel.statusHeadline,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .padding(top = SosSpacing.xs)
                    .testTag("wear_status_headline"),
        )
        if (!WearAmbientUiPolicy.hideSecondaryDetailInAmbient(isAmbient)) {
            Text(
                text = viewModel.statusDetail,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.testTag("wear_status_detail"),
            )
        }
        Text(
            text = stringResource(R.string.not112),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.labelSmall,
            modifier =
                Modifier
                    .padding(top = SosSpacing.xxs)
                    .testTag("wear_not112_disclaimer"),
        )
    }
}

@Composable
private fun ConfirmDialog(viewModel: WearSosViewModel) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(SosSpacing.xs),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        SosMeshLogo(size = 36.dp)
        Text(text = "SOS gönder?", textAlign = TextAlign.Center)
        Button(onClick = { viewModel.onConfirmSend() }, modifier = Modifier.padding(top = SosSpacing.xs)) {
            Text("Gönder")
        }
        Button(onClick = { viewModel.onConfirmCancel() }, modifier = Modifier.padding(top = SosSpacing.xxs)) {
            Text("İptal")
        }
    }
}

@Composable
private fun StatusPanel(
    viewModel: WearSosViewModel,
    accent: Color,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(accent)
                .padding(SosSpacing.sm),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = viewModel.statusHeadline, color = Color.White, textAlign = TextAlign.Center)
        Text(
            text = viewModel.statusDetail,
            color = Color.White,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = SosSpacing.xs),
        )
    }
}
