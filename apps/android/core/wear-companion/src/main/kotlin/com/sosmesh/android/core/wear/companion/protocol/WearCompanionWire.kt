package com.sosmesh.android.core.wear.companion.protocol

import kotlinx.serialization.Serializable

@Serializable
data class WearSosCreateWire(
    val version: Int = 1,
    val messageId: String,
    val nonce: String,
    val sosType: String,
    val personCount: Int? = null,
    val note: String = "",
    val language: String = "tr",
    val createdAtMs: Long,
)

@Serializable
data class WearPhoneAckWire(
    val version: Int = 1,
    val messageId: String,
    val nonce: String,
    val status: String,
    val outboxDigest: String? = null,
    val phoneNowMs: Long,
    val detail: String? = null,
)

object WearPhoneAckStatus {
    const val QUEUED = "PHONE_OUTBOX_QUEUED"
    const val DUPLICATE = "PHONE_OUTBOX_DUPLICATE"
    const val REJECTED = "PHONE_REJECTED"
}

object WearOutboundWireStatus {
    const val LOCAL_PENDING = "LOCAL_PENDING"
    const val AWAITING_PHONE = "AWAITING_PHONE"
    const val PHONE_QUEUED = "PHONE_QUEUED"
    const val PHONE_UNREACHABLE = "PHONE_UNREACHABLE"
    const val FAILED = "FAILED"
}
