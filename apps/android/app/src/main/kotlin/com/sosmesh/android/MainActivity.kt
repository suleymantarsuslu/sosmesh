package com.sosmesh.android

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.navigation.compose.currentBackStackEntryAsState
import com.sosmesh.android.core.design.theme.SosIosColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
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
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContent {
            val context = LocalContext.current
            var highContrast by remember { mutableStateOf(readHighContrast(context)) }
            var appUnlocked by remember { mutableStateOf(false) }
            SosMeshTheme(highContrast = highContrast) {
                Surface(color = MaterialTheme.colorScheme.background) {
                    PermissionGateRoute(
                        gateVisible = !appUnlocked,
                        onGatePassed = { appUnlocked = true },
                        onGateBlocked = { appUnlocked = false },
                    )
                    if (appUnlocked) {
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

private data class TopLevelTab(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector,
)

private val topLevelTabs =
    listOf(
        TopLevelTab("home", R.string.nav_home, Icons.Filled.Home),
        TopLevelTab("status", R.string.nav_status, Icons.AutoMirrored.Filled.TrendingUp),
        TopLevelTab("relay", R.string.nav_relay, Icons.Filled.Sensors),
        TopLevelTab("settings", R.string.nav_settings, Icons.Filled.Settings),
    )

@Composable
private fun SosMeshNavHost(onHighContrastChanged: () -> Unit) {
    val navController = rememberNavController()
    val appContext = LocalContext.current.applicationContext
    androidx.compose.runtime.LaunchedEffect(Unit) {
        // mesh-v2 §7: optional profile once, after the permission gate (notification permission) is passed.
        val done =
            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                runCatching {
                    dagger.hilt.android.EntryPointAccessors
                        .fromApplication(appContext, ProfileEntryPoint::class.java)
                        .profileStore()
                        .isOnboardingDone()
                }.getOrDefault(true)
            }
        if (!done) navController.navigate("profile")

        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val entry = dagger.hilt.android.EntryPointAccessors
                    .fromApplication(appContext, BroadcastEntryPoint::class.java)
                entry.broadcastPoller().start()
            }
        }
    }
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val navigateToTab: (String) -> Unit = { route ->
        navController.navigate(route) {
            popUpTo("home") { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (topLevelTabs.any { it.route == currentRoute }) {
                SosBottomBar(currentRoute = currentRoute, onSelect = navigateToTab)
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = "home",
            modifier = Modifier.padding(innerPadding).consumeWindowInsets(innerPadding),
        ) {
            composable("profile") {
                com.sosmesh.android.ui.profile.ProfileRoute(
                    onDone = { navController.popBackStack() },
                    onOpenSos = { navController.navigate("sos") },
                )
            }
            composable("home") {
                HomeRoute(
                    onOpenPermissions = { navController.navigate("permissions") },
                    onOpenRadioDebug = { navController.navigate("radio") },
                    onOpenSos = { navController.navigate("sos") },
                    onOpenStatus = { navigateToTab("status") },
                    onOpenRelay = { navigateToTab("relay") },
                    onOpenSettings = { navigateToTab("settings") },
                )
            }
            composable("permissions") {
                PermissionsRoute(onBack = { navController.popBackStack() })
            }
            composable("radio") {
                RadioDebugRoute(onBack = { navController.popBackStack() })
            }
            composable("sos") {
                SosRoute(
                    onNavigateToStatus = { navigateToTab("status") },
                )
            }
            composable("status") {
                StatusRoute()
            }
            composable("relay") {
                RelayRoute(onBack = { navigateToTab("home") })
            }
            composable("settings") {
                SettingsRoute(
                    onOpenProfile = { navController.navigate("profile") },
                    onOpenPermissions = { navController.navigate("permissions") },
                    onHighContrastChanged = onHighContrastChanged,
                )
            }
        }
    }
}

@Composable
private fun SosBottomBar(
    currentRoute: String?,
    onSelect: (String) -> Unit,
) {
    NavigationBar(
        containerColor = SosIosColors.CardBackground,
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        topLevelTabs.forEach { tab ->
            val label = stringResource(tab.labelRes)
            NavigationBarItem(
                selected = currentRoute == tab.route,
                onClick = { onSelect(tab.route) },
                icon = { Icon(imageVector = tab.icon, contentDescription = null) },
                label = { Text(label) },
                modifier = Modifier.testTag("nav_tab_" + tab.route),
                colors =
                    NavigationBarItemDefaults.colors(
                        selectedIconColor = SosIosColors.AccentBlueText,
                        selectedTextColor = SosIosColors.AccentBlueText,
                        indicatorColor = SosIosColors.AccentBlue.copy(alpha = 0.22f),
                        unselectedIconColor = SosIosColors.LabelTertiary,
                        unselectedTextColor = SosIosColors.LabelTertiary,
                    ),
            )
        }
    }
}

@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface ProfileEntryPoint {
    fun profileStore(): com.sosmesh.android.core.data.profile.SosProfileStore
}

@dagger.hilt.EntryPoint
@dagger.hilt.InstallIn(dagger.hilt.components.SingletonComponent::class)
interface BroadcastEntryPoint {
    fun broadcastPoller(): com.sosmesh.android.core.data.broadcast.BroadcastPoller
}
