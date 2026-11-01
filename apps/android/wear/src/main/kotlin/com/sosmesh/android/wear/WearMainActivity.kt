package com.sosmesh.android.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.sosmesh.android.wear.companion.WearAppCoordinatorHolder
import com.sosmesh.android.wear.ui.WearRootScreen
import com.sosmesh.android.wear.ui.WearSosViewModel

class WearMainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val coordinator = WearAppCoordinatorHolder.get(this)
        val viewModel =
            WearSosViewModel(
                coordinator = coordinator,
            )
        setContent {
            WearRootScreen(viewModel = viewModel)
        }
    }
}
