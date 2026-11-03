package com.sosmesh.android.core.design.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.sosmesh.android.core.design.R
import com.sosmesh.android.core.design.theme.SosSpacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SosScreenScaffold(
    title: String,
    modifier: Modifier = Modifier,
    showLogoInTopBar: Boolean = true,
    onNavigateBack: (() -> Unit)? = null,
    content: @Composable (Modifier) -> Unit,
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(SosSpacing.sm),
                    ) {
                        if (showLogoInTopBar) {
                            SosMeshLogo(size = SosSpacing.lg)
                        }
                        Text(text = title, style = MaterialTheme.typography.titleLarge)
                    }
                },
                navigationIcon = {
                    if (onNavigateBack != null) {
                        val backCd = stringResource(R.string.design_nav_back)
                        IconButton(
                            onClick = onNavigateBack,
                            modifier = Modifier.semantics { contentDescription = backCd },
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = backCd,
                            )
                        }
                    }
                },
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface,
                    ),
            )
        },
    ) { innerPadding ->
        content(
            Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = SosSpacing.lg, vertical = SosSpacing.md),
        )
    }
}

@Composable
fun SosScrollableScreenContent(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(SosSpacing.md),
        content = content,
    )
}

@Composable
fun SosStatusCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    androidx.compose.material3.Card(
        modifier = modifier.fillMaxWidth(),
        shape = com.sosmesh.android.core.design.theme.SosShapes.card,
        colors =
            androidx.compose.material3.CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
    ) {
        Column(
            modifier = Modifier.padding(SosSpacing.md),
            verticalArrangement = Arrangement.spacedBy(SosSpacing.xs),
        ) {
            content()
        }
    }
}

@Composable
fun SosEmptyState(
    message: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(vertical = SosSpacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(SosSpacing.md),
    ) {
        SosMeshLogo(size = SosSpacing.xl + SosSpacing.lg)
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun SosTimelineStep(
    label: String,
    reached: Boolean,
    modifier: Modifier = Modifier,
) {
    val style =
        if (reached) {
            MaterialTheme.typography.titleSmall
        } else {
            MaterialTheme.typography.bodySmall
        }
    val color =
        if (reached) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        }
    Text(
        text = label,
        style = style,
        color = color,
        modifier = modifier.fillMaxWidth(),
    )
}
