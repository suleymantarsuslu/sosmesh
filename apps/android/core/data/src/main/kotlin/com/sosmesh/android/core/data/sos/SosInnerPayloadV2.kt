package com.sosmesh.android.core.data.sos

import com.sosmesh.android.core.data.profile.SosProfile
import com.sosmesh.android.core.model.SosType
import kotlinx.serialization.Serializable

/** mesh-v2 §2.1 L3 inner payload (sos-inner-payload-v2.schema.json). Encrypted; never logged. */
@Serializable
data class SosInnerPayloadV2(
    val innerVersion: Int = 2,
    val senderKey: String,
    val seq: Long,
    val createdAt: String,
    val sosType: String? = null,
    val note: String? = null,
    val language: String? = null,
    val location: SosInnerLocationV2? = null,
    val personCount: Int? = null,
    val profile: SosProfile? = null,
    val profileChanged: Boolean? = null,
)

@Serializable
data class SosInnerLocationV2(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double? = null,
    val timestamp: String,
)

object SosInnerV2Mapping {
    const val MAX_INNER_BYTES = 4096
    const val MAX_NOTE_BYTES = 2000

    fun sosType(type: SosType): String =
        when (type) {
            SosType.DEPREM -> "GENERAL"
            SosType.YANGIN -> "FIRE"
            SosType.YARALANMA -> "MEDICAL"
            SosType.SEL -> "OTHER"
            SosType.DIGER -> "OTHER"
        }

    /** Trim to ≤ 1000 chars and ≤ 2000 UTF-8 bytes. */
    fun clampNote(note: String?): String? {
        var n = note?.trim()?.take(1000)?.ifEmpty { null } ?: return null
        while (n.toByteArray(Charsets.UTF_8).size > MAX_NOTE_BYTES) n = n.dropLast(1)
        return n
    }
}
