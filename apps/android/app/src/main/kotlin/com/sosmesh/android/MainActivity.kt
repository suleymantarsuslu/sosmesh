package com.sosmesh.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.sosmesh.android.feature.sos.SosRoute
import com.sosmesh.android.feature.status.StatusRoute
import com.sosmesh.android.ui.home.HomeRoute
import com.sosmesh.android.ui.permissions.PermissionsRoute
import com.sosmesh.android.ui.theme.SosMeshTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SosMeshTheme {
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
                onOpenSos = { navController.navigate("sos") },
                onOpenStatus = { navController.navigate("status") },
            )
        }
        composable("permissions") {
            PermissionsRoute(onBack = { navController.popBackStack() })
        }
        composable("sos") {
            SosRoute()
        }
        composable("status") {
            StatusRoute()
        }
    }
}
