package com.sosmesh.android.feature.sos

import com.sosmesh.android.core.data.mesh.SosPeerDeliveryPort
import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.model.SosType
import com.sosmesh.android.core.permissions.BleMeshReadiness
import com.sosmesh.android.core.permissions.PermissionFlowCoordinator
import com.sosmesh.android.feature.sos.location.SosLocationProvider
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** One-tap express SOS with safe defaults (ADIM 29). Does not skip preview in guided flow. */
@Singleton
class ExpressSosSaver
    @Inject
    constructor(
        private val locationProvider: SosLocationProvider,
        private val submitRepository: SosSubmitRepository,
        private val peerDelivery: SosPeerDeliveryPort,
        private val bleMeshReadiness: BleMeshReadiness,
        private val permissionFlowCoordinator: PermissionFlowCoordinator,
        private val openCaseTracker: OpenCaseTracker,
    ) {
        private var lastExpressId: String? = null
        private var lastExpressDigest: String? = null
        private var lastExpressLeftDevice: Boolean = false

        suspend fun save(nowMs: Long = System.currentTimeMillis()): String {
            val hasOpenCase = openCaseTracker.hasOpenCase(nowMs)
            if (hasOpenCase && lastExpressId != null && lastExpressDigest != null) {
                submitRepository.deleteIfUnsent(lastExpressId!!, lastExpressDigest!!)
            }

            val location = if (locationProvider is com.sosmesh.android.feature.sos.location.AndroidGpsLocationProvider) {
                locationProvider.requestLocationAsync(timeoutMs = 2000)
            } else {
                locationProvider.currentLocation()
            }

            val composed =
                submitRepository.submit(
                    SosComposeRequest(
                        sosType = SosType.DIGER,
                        personCount = null,
                        note = "",
                        location = location,
                        languageTag = Locale.getDefault().language,
                        nowMs = nowMs,
                    ),
                )
            
            val delivery = if (bleMeshReadiness.canRunBleMeshFeatures()) {
                peerDelivery.kickOffAfterLocalSave(nowMs, foregroundVisible = true)
            } else {
                null
            }
            
            lastExpressId = composed.message.id
            lastExpressDigest = composed.digest
            lastExpressLeftDevice = delivery is com.sosmesh.android.core.data.mesh.SosPeerDeliveryKickResult.TransferStarted
            
            if (!hasOpenCase) {
                openCaseTracker.markCaseOpen(composed.message.id, nowMs)
            }
            
            return composed.message.id
        }
    }
