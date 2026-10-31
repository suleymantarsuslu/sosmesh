package com.sosmesh.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.sosmesh.android.ui.home.HomeRoute
import com.sosmesh.android.ui.permissions.PermissionsRoute
import com.sosmesh.android.ui.radio.RadioDebugRoute
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface {
                    SosMeshNavHost()
                }
            }
        }
    }
}

@Composable
private fun SosMeshNavHost() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "home") {
        composable("home") {
            HomeRoute(
                onOpenPermissions = { navController.navigate("permissions") },
                onOpenRadioDebug = { navController.navigate("radio") },
            )
        }
        composable("permissions") {
            PermissionsRoute(onBack = { navController.popBackStack() })
        }
        composable("radio") {
            RadioDebugRoute(onBack = { navController.popBackStack() })
        }
    }
}
