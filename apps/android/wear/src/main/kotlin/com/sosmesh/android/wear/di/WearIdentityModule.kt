package com.sosmesh.android.wear.di

import android.content.Context
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.security.SecureRandom
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class WearRelayIdHex

@Module
@InstallIn(SingletonComponent::class)
object WearIdentityModule {
    @Provides
    @Singleton
    @WearRelayIdHex
    fun provideWearRelayIdHex(
        @ApplicationContext context: Context,
    ): String {
        val prefs = context.getSharedPreferences("wear_relay_identity", Context.MODE_PRIVATE)
        val existing = prefs.getString("install_relay_id_hex", null)
        if (existing != null && existing.length == 64) {
            return existing
        }
        val bytes = ByteArray(32)
        SecureRandom().nextBytes(bytes)
        val generated = bytes.joinToString(separator = "") { byte -> "%02x".format(byte) }
        prefs.edit().putString("install_relay_id_hex", generated).commit()
        return generated
    }
}
