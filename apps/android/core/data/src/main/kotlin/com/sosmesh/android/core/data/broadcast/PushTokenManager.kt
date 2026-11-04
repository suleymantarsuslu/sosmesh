package com.sosmesh.android.core.data.broadcast

import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PushTokenManager
    @Inject
    constructor(
        private val context: Context,
        private val httpClient: OkHttpClient,
        private val apiBaseUrl: String,
    ) {
        suspend fun registerToken(token: String) =
            withContext(Dispatchers.IO) {
                try {
                    val deviceId =
                        Settings.Secure.getString(
                            context.contentResolver,
                            Settings.Secure.ANDROID_ID,
                        )

                    val json =
                        JSONObject().apply {
                            put("platform", "android")
                            put("token", token)
                            put("deviceId", deviceId)
                        }

                    val body = json.toString().toRequestBody("application/json".toMediaType())
                    val request =
                        Request.Builder()
                            .url("$apiBaseUrl/v1/device/push-tokens")
                            .post(body)
                            .build()

                    httpClient.newCall(request).execute().use { response ->
                        // Silently ignore errors
                    }
                } catch (e: Exception) {
                    // Silently ignore errors
                }
            }
    }
