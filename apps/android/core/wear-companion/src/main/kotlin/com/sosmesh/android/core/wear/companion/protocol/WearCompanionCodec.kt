package com.sosmesh.android.core.wear.companion.protocol

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object WearCompanionCodec {
    private val json =
        Json {
            ignoreUnknownKeys = false
            encodeDefaults = true
            explicitNulls = true
        }

    fun encodeCreate(message: WearSosCreateWire): ByteArray =
        json.encodeToString(message).toByteArray(Charsets.UTF_8)

    fun decodeCreate(bytes: ByteArray): WearSosCreateWire =
        json.decodeFromString(String(bytes, Charsets.UTF_8))

    fun encodeAck(ack: WearPhoneAckWire): ByteArray =
        json.encodeToString(ack).toByteArray(Charsets.UTF_8)

    fun decodeAck(bytes: ByteArray): WearPhoneAckWire =
        json.decodeFromString(String(bytes, Charsets.UTF_8))
}
