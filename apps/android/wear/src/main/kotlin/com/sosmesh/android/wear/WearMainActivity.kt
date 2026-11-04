package com.sosmesh.android.wear

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.fragment.app.FragmentActivity
import androidx.wear.ambient.AmbientModeSupport
import com.sosmesh.android.wear.ui.WearRelayViewModel
import com.sosmesh.android.wear.ui.WearRootScreen
import com.sosmesh.android.wear.ui.WearSosViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class WearMainActivity :
    FragmentActivity(),
    AmbientModeSupport.AmbientCallbackProvider {
    private lateinit var ambientController: AmbientModeSupport.AmbientController
    
    private val viewModel: WearSosViewModel by viewModels()
    private val relayViewModel: WearRelayViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        
        ambientController = AmbientModeSupport.attach(this)
        setContent {
            WearRootScreen(
                viewModel = viewModel,
                relayViewModel = relayViewModel,
            )
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
