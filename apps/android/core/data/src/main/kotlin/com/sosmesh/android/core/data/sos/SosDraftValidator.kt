package com.sosmesh.android.core.data.sos

import com.sosmesh.android.core.model.SosFormLimits
import com.sosmesh.android.core.model.SosType

sealed class SosDraftValidation {
    data object Valid : SosDraftValidation()

    data class Invalid(val reason: DraftInvalidReason) : SosDraftValidation()
}

enum class DraftInvalidReason {
    PERSON_COUNT_TOO_LOW,
    PERSON_COUNT_TOO_HIGH,
    NOTE_TOO_LONG,
}

data class SosDraftInput(
    val sosType: SosType,
    val personCountText: String,
    val personCountUnknown: Boolean,
    val note: String,
)

object SosDraftValidator {
    fun validate(input: SosDraftInput): SosDraftValidation {
        if (input.note.length > SosFormLimits.MAX_NOTE_LENGTH) {
            return SosDraftValidation.Invalid(DraftInvalidReason.NOTE_TOO_LONG)
        }
        if (input.personCountUnknown) {
            return SosDraftValidation.Valid
        }
        val trimmed = input.personCountText.trim()
        if (trimmed.isEmpty()) {
            // mesh-v2 §2.1 / invariant 3: an empty SOS is valid; blank count = unknown.
            return SosDraftValidation.Valid
        }
        val count =
            trimmed.toIntOrNull()
                ?: return SosDraftValidation.Invalid(DraftInvalidReason.PERSON_COUNT_TOO_LOW)
        if (count < SosFormLimits.MIN_PERSON_COUNT) {
            return SosDraftValidation.Invalid(DraftInvalidReason.PERSON_COUNT_TOO_LOW)
        }
        if (count > SosFormLimits.MAX_PERSON_COUNT) {
            return SosDraftValidation.Invalid(DraftInvalidReason.PERSON_COUNT_TOO_HIGH)
        }
        return SosDraftValidation.Valid
    }

    fun parsedPersonCount(input: SosDraftInput): Int? {
        if (input.personCountUnknown) return null
        return input.personCountText.trim().toIntOrNull()?.takeIf { it in SosFormLimits.MIN_PERSON_COUNT..SosFormLimits.MAX_PERSON_COUNT }
    }
}
