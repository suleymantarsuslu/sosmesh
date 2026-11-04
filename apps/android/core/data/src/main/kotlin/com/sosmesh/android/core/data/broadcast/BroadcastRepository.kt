package com.sosmesh.android.core.data.broadcast

import android.content.Context
import android.location.Location
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

class BroadcastRepository(
    private val context: Context,
    private val httpClient: OkHttpClient,
    private val apiBaseUrl: String,
    publicKeyBase64: String,
) {
    private val store = BroadcastStore(context)
    private val verifier = BroadcastSignatureVerifier(publicKeyBase64)

    suspend fun fetchAndProcessBroadcasts(currentLocation: Location?): List<ServerBroadcast> =
        withContext(Dispatchers.IO) {
            val lastFetch = store.getLastFetchTime() ?: Instant.now().minusSeconds(7 * 24 * 3600).toString()
            val url = "$apiBaseUrl/v1/device/broadcasts/active?since=$lastFetch"

            val request = Request.Builder().url(url).build()
            val response = httpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                return@withContext emptyList()
            }

            val jsonArray = JSONArray(response.body?.string() ?: "[]")
            val broadcasts = mutableListOf<ServerBroadcast>()
            val now = Instant.now()
            var maxCreatedAt: String? = null

            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val broadcast = parseBroadcast(obj) ?: continue

                if (store.isSeen(broadcast.id)) continue

                val expiresAt = Instant.parse(broadcast.expiresAt)
                if (expiresAt.isBefore(now)) continue

                if (!verifier.verify(broadcast)) continue

                if (broadcast.regionLat != null && broadcast.regionLng != null && broadcast.regionRadiusKm != null) {
                    if (currentLocation != null) {
                        val distanceKm = calculateDistance(
                            currentLocation.latitude,
                            currentLocation.longitude,
                            broadcast.regionLat,
                            broadcast.regionLng,
                        )
                        if (distanceKm > broadcast.regionRadiusKm) continue
                    }
                }

                broadcasts.add(broadcast)
                store.markSeen(broadcast.id)

                if (maxCreatedAt == null || broadcast.createdAt > maxCreatedAt) {
                    maxCreatedAt = broadcast.createdAt
                }
            }

            if (maxCreatedAt != null) {
                store.updateLastFetchTime(maxCreatedAt)
            }

            broadcasts
        }

    private fun parseBroadcast(obj: JSONObject): ServerBroadcast? {
        return try {
            ServerBroadcast(
                id = obj.getString("id"),
                title = obj.getString("title"),
                body = obj.getString("body"),
                severity = obj.getString("severity"),
                createdAt = obj.getString("createdAt"),
                expiresAt = obj.getString("expiresAt"),
                regionLat = if (obj.isNull("regionLatitude")) null else obj.getDouble("regionLatitude"),
                regionLng = if (obj.isNull("regionLongitude")) null else obj.getDouble("regionLongitude"),
                regionRadiusKm = if (obj.isNull("regionRadiusKm")) null else obj.getDouble("regionRadiusKm"),
                signature = obj.getString("signature"),
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a =
            kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) +
                kotlin.math.cos(Math.toRadians(lat1)) * kotlin.math.cos(Math.toRadians(lat2)) *
                kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)
        val c = 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
        return r * c
    }
}
