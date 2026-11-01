package com.sosmesh.android.core.model

enum class SosType(val wireValue: String) {
    DEPREM("deprem"),
    YANGIN("yangın"),
    SEL("sel"),
    YARALANMA("yaralanma"),
    DIGER("diğer"),
    ;

    companion object {
        fun fromWire(value: String): SosType? = entries.find { it.wireValue == value }
    }
}

object SosFormLimits {
    const val MIN_PERSON_COUNT = 1
    const val MAX_PERSON_COUNT = 99
    const val MAX_NOTE_LENGTH = 200
}
