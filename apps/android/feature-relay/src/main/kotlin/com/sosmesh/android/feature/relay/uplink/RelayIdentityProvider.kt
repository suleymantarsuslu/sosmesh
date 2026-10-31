package com.sosmesh.android.feature.relay.uplink

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RelayIdentityProvider
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
    ) {
        /** 64 hex chars (32 random bytes); stable per app install, not derived from device ids. */
        val relayIdHex: String by lazy { loadOrCreateInstallRelayId() }

        private fun loadOrCreateInstallRelayId(): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val existing = prefs.getString(KEY_INSTALL_RELAY_ID_HEX, null)
            if (existing != null && existing.length == INSTALL_ID_HEX_LENGTH) {
                return existing
            }
            val generated = randomInstallIdHex()
            prefs.edit().putString(KEY_INSTALL_RELAY_ID_HEX, generated).commit()
            return generated
        }

        private fun randomInstallIdHex(): String {
            val bytes = ByteArray(INSTALL_ID_BYTES)
            SecureRandom().nextBytes(bytes)
            return bytes.joinToString(separator = "") { byte -> "%02x".format(byte) }
        }

        companion object {
            private const val PREFS_NAME = "relay_identity"
            private const val KEY_INSTALL_RELAY_ID_HEX = "install_relay_id_hex"
            private const val INSTALL_ID_BYTES = 32
            private const val INSTALL_ID_HEX_LENGTH = INSTALL_ID_BYTES * 2
        }
    }
