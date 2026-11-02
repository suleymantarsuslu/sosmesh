package com.sosmesh.android.wear

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.fragment.app.FragmentActivity
import androidx.wear.ambient.AmbientModeSupport
import com.sosmesh.android.wear.companion.WearAppCoordinatorHolder
import com.sosmesh.android.wear.ui.WearRootScreen
import com.sosmesh.android.wear.ui.WearSosViewModel

class WearMainActivity :
    FragmentActivity(),
    AmbientModeSupport.AmbientCallbackProvider {
    private lateinit var ambientController: AmbientModeSupport.AmbientController
    private lateinit var viewModel: WearSosViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val coordinator = WearAppCoordinatorHolder.get(this)
        viewModel =
            WearSosViewModel(
                coordinator = coordinator,
            )
        ambientController = AmbientModeSupport.attach(this)
        setContent {
            WearRootScreen(viewModel = viewModel)
        }
    }

    override fun getAmbientCallback(): AmbientModeSupport.AmbientCallback =
        object : AmbientModeSupport.AmbientCallback() {
            override fun onEnterAmbient(ambientDetails: Bundle) {
                viewModel.applyAmbientMode(true)
            }

            override fun onUpdateAmbient() {
                viewModel.applyAmbientMode(true)
            }

            override fun onExitAmbient() {
                viewModel.applyAmbientMode(false)
            }
        }
}
