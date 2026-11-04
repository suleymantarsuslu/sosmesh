package com.sosmesh.android.core.design.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.R
import com.sosmesh.android.core.design.theme.SosSpacing

/** iOS-style screen: grouped background, centered inline title, optional back arrow. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SosScreenScaffold(
    title: String,
    modifier: Modifier = Modifier,
    showLogoInTopBar: Boolean = true,
    onNavigateBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    content: @Composable (Modifier) -> Unit,
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(SosSpacing.xs),
                    ) {
                        if (showLogoInTopBar) {
                            SosMeshLogo(size = SosSpacing.xl)
                        }
                        Text(text = title, style = MaterialTheme.typography.titleMedium)
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
                actions = actions,
                colors =
                    TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background,
                        titleContentColor = MaterialTheme.colorScheme.onBackground,
                        navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                    ),
            )
        },
    ) { innerPadding ->
        content(
            Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = SosSpacing.md, vertical = SosSpacing.sm),
        )
    }
}

@Composable
fun SosScrollableScreenContent(
    modifier: Modifier = Modifier,
    spacing: Dp = SosSpacing.md,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(spacing),
        content = content,
    )
}

/** Plain card (iOS SOSCard): black surface, 12dp radius, 16dp padding. */
@Composable
fun SosStatusCard(
    modifier: Modifier = Modifier,
    highlighted: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    SosCard(modifier = modifier, highlighted = highlighted, content = content)
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
        Icon(
            imageVector = Icons.Filled.Inbox,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.outline,
            modifier = Modifier.size(64.dp),
        )
        Text(
            text = message,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun SosTimelineStep(
    label: String,
    reached: Boolean,
    modifier: Modifier = Modifier,
) {
    SosTimelineRow(label = label, reached = reached, modifier = modifier)
}
