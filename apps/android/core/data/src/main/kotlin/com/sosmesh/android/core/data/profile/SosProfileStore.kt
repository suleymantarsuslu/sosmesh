package com.sosmesh.android.core.data.profile

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.json.Json
import java.security.MessageDigest
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/** Sender identity for the v2 inner payload of one SOS. */
data class SosSenderContext(
    val senderKey: String,
    val seq: Long,
    val profile: SosProfile?,
    val profileChanged: Boolean,
)

/** Supplies the v2 sender context for the next SOS, or null to fall back to the v1 inner payload. */
fun interface SosSenderContextSource {
    fun nextSenderContextOrNull(): SosSenderContext?
}

/**
 * mesh-v2 §1 senderKey + §7 profile in EncryptedSharedPreferences (AES-256-GCM, StrongBox when available).
 * Not in the outbox or plain SharedPreferences; values are never logged. Excluded from backup by the app's rules.
 */
@Singleton
class SosProfileStore
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) : SosSenderContextSource {
        override fun nextSenderContextOrNull(): SosSenderContext? =
            try {
                nextSenderContext()
            } catch (_: Exception) {
                null
            }

        private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }

        private val prefs: SharedPreferences by lazy {
            val masterKey =
                MasterKey.Builder(context, MASTER_KEY_ALIAS)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .setRequestStrongBoxBacked(true)
                    .build()
            EncryptedSharedPreferences.create(
                context,
                PREFS_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }

        fun profile(): SosProfile? =
            prefs.getString(KEY_PROFILE, null)?.let {
                try {
                    json.decodeFromString(SosProfile.serializer(), it)
                } catch (_: Exception) {
                    null
                }
            }

        fun saveProfile(profile: SosProfile) {
            val clean = profile.sanitized()
            prefs.edit()
                .putString(KEY_PROFILE, json.encodeToString(SosProfile.serializer(), clean))
                .putBoolean(KEY_ONBOARDING_DONE, true)
                .apply()
        }

        fun deleteProfile() {
            prefs.edit().remove(KEY_PROFILE).remove(KEY_LAST_SENT_PROFILE_HASH).apply()
        }

        fun isOnboardingDone(): Boolean = prefs.getBoolean(KEY_ONBOARDING_DONE, false)

        fun markOnboardingDone() {
            prefs.edit().putBoolean(KEY_ONBOARDING_DONE, true).apply()
        }

        fun hasProfile(): Boolean = profile()?.isEmpty() == false

        @Synchronized
        fun senderKey(): String {
            prefs.getString(KEY_SENDER_KEY, null)?.let { return it }
            val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
            val hex = bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
            prefs.edit().putString(KEY_SENDER_KEY, hex).apply()
            return hex
        }

        /**
         * Allocates the next seq. Full profile goes on the first SOS of a process session, then only when changed.
         */
        @Synchronized
        fun nextSenderContext(): SosSenderContext {
            val seq = prefs.getLong(KEY_SEQ, 0L) + 1
            val profile = profile()?.sanitized()?.takeIf { !it.isEmpty() }
            val hash = profile?.let { sha256Hex(json.encodeToString(SosProfile.serializer(), it)) }
            val lastHash = prefs.getString(KEY_LAST_SENT_PROFILE_HASH, null)
            val changed = hash != null && hash != lastHash
            val include = profile != null && (changed || !sentThisSession)
            sentThisSession = sentThisSession || include
            prefs.edit()
                .putLong(KEY_SEQ, seq)
                .apply { if (hash != null) putString(KEY_LAST_SENT_PROFILE_HASH, hash) }
                .apply()
            return SosSenderContext(senderKey(), seq, if (include) profile else null, include && changed && lastHash != null)
        }

        private var sentThisSession = false

        private fun sha256Hex(s: String): String =
            MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 0xFF) }

        companion object {
            private const val PREFS_FILE = "sosmesh_profile_secure"
            private const val MASTER_KEY_ALIAS = "sosmesh_profile_master_key"
            private const val KEY_PROFILE = "profile_v2"
            private const val KEY_ONBOARDING_DONE = "onboarding_done"
            private const val KEY_SENDER_KEY = "sender_key"
            private const val KEY_SEQ = "sender_seq"
            private const val KEY_LAST_SENT_PROFILE_HASH = "profile_last_sent_hash"
        }
    }
