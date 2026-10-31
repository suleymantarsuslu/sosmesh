package com.sosmesh.android.feature.relay.uplink

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.security.MessageDigest

object IngestPacketHash {
    fun computePacketHash(sosMessage: JsonObject): String {
        val canonical = stableStringify(sosMessage)
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(canonical.toByteArray(Charsets.UTF_8)).joinToString("") { byte ->
            "%02x".format(byte)
        }
    }

    private fun stableStringify(value: JsonElement): String =
        when (value) {
            is JsonNull -> "null"
            is JsonPrimitive -> {
                if (value.isString) {
                    JsonPrimitive(value.content).toString()
                } else {
                    value.toString()
                }
            }
            is JsonArray -> value.joinToString(prefix = "[", postfix = "]", separator = ",") { stableStringify(it) }
            is JsonObject -> {
                val keys = value.keys.sorted()
                keys.joinToString(prefix = "{", postfix = "}", separator = ",") { key ->
                    "${JsonPrimitive(key)}:${stableStringify(value.getValue(key))}"
                }
            }
        }
}
