package com.sosmesh.android.feature.sos

import com.sosmesh.android.core.data.sos.SosComposeRequest
import com.sosmesh.android.core.model.SosType
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
    ) {
        fun save(nowMs: Long = System.currentTimeMillis()): String {
            val composed =
                submitRepository.submit(
                    SosComposeRequest(
                        sosType = SosType.DIGER,
                        personCount = null,
                        note = "",
                        location = locationProvider.currentLocation(),
                        languageTag = Locale.getDefault().language,
                        nowMs = nowMs,
                    ),
                )
            return composed.message.id
        }
    }
