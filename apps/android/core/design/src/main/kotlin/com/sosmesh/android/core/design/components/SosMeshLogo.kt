package com.sosmesh.android.core.design.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.sosmesh.android.core.design.R

@Composable
fun SosMeshLogo(
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
) {
    val cd = stringResource(R.string.design_logo_content_description)
    Image(
        painter = painterResource(R.drawable.ic_sosmesh_logo),
        contentDescription = cd,
        contentScale = ContentScale.Fit,
        modifier =
            modifier
                .size(size)
                .testTag("sosmesh_logo")
                .semantics { contentDescription = cd },
    )
}
