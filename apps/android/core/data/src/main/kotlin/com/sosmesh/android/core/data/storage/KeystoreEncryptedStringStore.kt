package com.sosmesh.android.core.data.storage

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Android Keystore-backed preferences (hardware-backed when available).
 * CI Robolectric/unit tests do not validate real Keystore — see ADIM 12 NOT_TESTED notes.
 */
@Singleton
class KeystoreEncryptedStringStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) : SecureStringStore {
        private val masterKey =
            MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

        private val prefs =
            EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )

        override fun put(
            key: String,
            value: String,
        ) {
            prefs.edit().putString(key, value).apply()
        }

        override fun get(key: String): String? = prefs.getString(key, null)

        companion object {
            private const val PREFS_FILE = "sosmesh_secure_prefs"
        }
    }
