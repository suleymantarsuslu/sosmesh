package com.sosmesh.android.feature.relay.uplink

import android.content.Context
import android.provider.Settings
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayIdentityProvider
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        val relayIdHex: String by lazy {
            val androidId =
                Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                    ?: "unknown-device"
            sha256Hex(androidId.toByteArray(Charsets.UTF_8))
        }

        private fun sha256Hex(bytes: ByteArray): String {
            val digest = MessageDigest.getInstance("SHA-256")
            return digest.digest(bytes).joinToString(separator = "") { byte ->
                "%02x".format(byte)
            }
        }
    }
