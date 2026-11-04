package com.sosmesh.android

import android.content.Context
import android.content.Intent
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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.navigation.compose.currentBackStackEntryAsState
import com.sosmesh.android.core.design.theme.SosIosColors
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val _openSosFromWidget = MutableStateFlow(false)
    private val openSosFromWidget = _openSosFromWidget.asStateFlow()

    @Inject
    lateinit var broadcastDialogCoordinator: com.sosmesh.android.broadcast.BroadcastDialogCoordinator

    @Inject
    lateinit var relayController: com.sosmesh.android.core.data.relay.RelayController

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        handleWidgetIntent(intent)
        setContent {
            val context = LocalContext.current
            var highContrast by remember { mutableStateOf(readHighContrast(context)) }
            var appUnlocked by remember { mutableStateOf(false) }
            val pendingRelayRequest by broadcastDialogCoordinator.pendingRelayRequest.collectAsState()

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
                            openSosFromWidgetFlow = openSosFromWidget,
                            onSosNavigationConsumed = { _openSosFromWidget.value = false },
                        )
                    }

                    pendingRelayRequest?.let { broadcast ->
                        AlertDialog(
                            onDismissRequest = { broadcastDialogCoordinator.dismissRelayRequestDialog() },
                            title = { Text(broadcast.title) },
                            text = { Text(broadcast.body) },
                            confirmButton = {
                                TextButton(onClick = {
                                    relayController.setRelayEnabled(true)
                                    broadcastDialogCoordinator.dismissRelayRequestDialog()
                                }) {
                                    Text(stringResource(R.string.broadcast_relay_request_action_enable))
                                }
                            },
                            dismissButton = {
                                TextButton(onClick = {
                                    broadcastDialogCoordinator.dismissRelayRequestDialog()
                                }) {
                                    Text(stringResource(R.string.broadcast_relay_request_action_cancel))
                                }
                            },
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleWidgetIntent(intent)
    }

    private fun handleWidgetIntent(intent: Intent?) {
        if (intent?.getBooleanExtra(com.sosmesh.android.widget.SosWidgetProvider.EXTRA_OPEN_SOS, false) == true) {
            _openSosFromWidget.value = true
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
private fun SosMeshNavHost(
    onHighContrastChanged: () -> Unit,
    openSosFromWidgetFlow: kotlinx.coroutines.flow.StateFlow<Boolean>,
    onSosNavigationConsumed: () -> Unit,
) {
    val navController = rememberNavController()
    val appContext = LocalContext.current.applicationContext
    val openSosFromWidget by androidx.compose.runtime.collectAsState(openSosFromWidgetFlow)
    
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
        if (!done) {
            navController.navigate("profile")
        }

        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            runCatching {
                val entry = dagger.hilt.android.EntryPointAccessors
                    .fromApplication(appContext, BroadcastEntryPoint::class.java)
                entry.broadcastPoller().start()
            }
        }
    }
    
    androidx.compose.runtime.LaunchedEffect(openSosFromWidget) {
        if (openSosFromWidget) {
            navController.navigate("sos") {
                launchSingleTop = true
            }
            onSosNavigationConsumed()
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
                    onOpenNotifications = { navController.navigate("notifications") },
                )
            }
            composable("notifications") {
                com.sosmesh.android.ui.notifications.NotificationsRoute(
                    onNavigateToRelay = { navigateToTab("relay") },
                    onBack = { navController.popBackStack() },
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
