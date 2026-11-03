package com.sosmesh.android

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.sosmesh.android.feature.relay.RelayRoute
import com.sosmesh.android.feature.sos.SosRoute
import com.sosmesh.android.feature.status.StatusRoute
import com.sosmesh.android.ui.gate.PermissionGateRoute
import com.sosmesh.android.ui.home.HomeRoute
import com.sosmesh.android.ui.permissions.PermissionsRoute
import com.sosmesh.android.ui.radio.RadioDebugRoute
import com.sosmesh.android.ui.settings.SettingsRoute
import com.sosmesh.android.ui.settings.SettingsViewModel
import com.sosmesh.android.ui.theme.SosMeshTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val context = LocalContext.current
            var highContrast by remember { mutableStateOf(readHighContrast(context)) }
            var permissionGatePassed by rememberSaveable { mutableStateOf(false) }
            SosMeshTheme(highContrast = highContrast) {
                Surface {
                    if (!permissionGatePassed) {
                        PermissionGateRoute(onGatePassed = { permissionGatePassed = true })
                    } else {
                        SosMeshNavHost(
                            onHighContrastChanged = { highContrast = readHighContrast(context) },
                        )
                    }
                }
            }
        }
    }
}

private fun readHighContrast(context: Context): Boolean =
    context.getSharedPreferences(SettingsViewModel.PREFS_NAME, Context.MODE_PRIVATE)
        .getBoolean(SettingsViewModel.KEY_HIGH_CONTRAST, false)

@Composable
private fun SosMeshNavHost(onHighContrastChanged: () -> Unit) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            HomeRoute(
                onOpenPermissions = { navController.navigate("permissions") },
                onOpenRadioDebug = { navController.navigate("radio") },
                onOpenSos = { navController.navigate("sos") },
                onOpenStatus = { navController.navigate("status") },
                onOpenRelay = { navController.navigate("relay") },
                onOpenSettings = { navController.navigate("settings") },
            )
        }
        composable("permissions") {
            PermissionsRoute(onBack = { navController.popBackStack() })
        }
        composable("radio") {
            RadioDebugRoute(onBack = { navController.popBackStack() })
        }
        composable("sos") {
            SosRoute()
        }
        composable("status") {
            StatusRoute()
        }
        composable("relay") {
            RelayRoute(onBack = { navController.popBackStack() })
        }
        composable("settings") {
            SettingsRoute(
                onBack = {
                    onHighContrastChanged()
                    navController.popBackStack()
                },
            )
        }
    }
}
