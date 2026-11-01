package com.sosmesh.android.core.data.sos

/** Maps outbox / delivery states to UX timeline step labels (TR defaults for unit tests). */
object DeliveryTimelineLabels {
    const val LOCAL_SAVED_TR = "CİHAZDA KAYITLI"
    const val PEER_RECEIVED_TR = "YAKIN CİHAZA AKTARILDI"
    const val SERVER_ACCEPTED_TR = "SUNUCUYA ULAŞTI"
    const val OPERATOR_SEEN_TR = "OPERATÖR GÖRDÜ"
    const val CASE_IN_PROGRESS_TR = "VAKA İŞLEME ALINDI"
    const val FAILED_TR = "Gönderim başarısız"
    const val EXPIRED_TR = "Süresi doldu"

    const val LOCAL_SAVED_EN = "SAVED ON DEVICE"
    const val PEER_RECEIVED_EN = "TRANSFERRED TO NEARBY DEVICE"
    const val SERVER_ACCEPTED_EN = "REACHED SERVER"
    const val OPERATOR_SEEN_EN = "OPERATOR VIEWED"
    const val CASE_IN_PROGRESS_EN = "CASE IN PROGRESS"
    const val FAILED_EN = "Delivery failed"
    const val EXPIRED_EN = "Expired"

    fun labelForState(
        state: String,
        english: Boolean,
    ): String {
        if (english) {
            return when (state) {
                "LOCAL_SAVED" -> LOCAL_SAVED_EN
                "PEER_RECEIVED" -> PEER_RECEIVED_EN
                "SERVER_ACCEPTED" -> SERVER_ACCEPTED_EN
                "OPERATOR_SEEN" -> OPERATOR_SEEN_EN
                "CASE_IN_PROGRESS" -> CASE_IN_PROGRESS_EN
                "FAILED" -> FAILED_EN
                "EXPIRED" -> EXPIRED_EN
                else -> state
            }
        }
        return when (state) {
            "LOCAL_SAVED" -> LOCAL_SAVED_TR
            "PEER_RECEIVED" -> PEER_RECEIVED_TR
            "SERVER_ACCEPTED" -> SERVER_ACCEPTED_TR
            "OPERATOR_SEEN" -> OPERATOR_SEEN_TR
            "CASE_IN_PROGRESS" -> CASE_IN_PROGRESS_TR
            "FAILED" -> FAILED_TR
            "EXPIRED" -> EXPIRED_TR
            else -> state
        }
    }

    fun userDescriptionForState(
        state: String,
        english: Boolean,
    ): String {
        if (english) {
            return when (state) {
                "LOCAL_SAVED" ->
                    "Message saved on this device; searching for a nearby device to relay."
                "PEER_RECEIVED" ->
                    "A nearby device received the message; waiting for internet relay."
                "SERVER_ACCEPTED" -> "Reached the server and is visible to operators."
                "OPERATOR_SEEN" -> "An operator viewed the case."
                "CASE_IN_PROGRESS" -> "Case is in progress."
                "FAILED" -> "Delivery failed; message remains on device."
                "EXPIRED" -> "Message expired before delivery completed."
                else -> state
            }
        }
        return when (state) {
            "LOCAL_SAVED" ->
                "Mesajınız cihazınızda kaydedildi; yakındaki cihaz aranıyor."
            "PEER_RECEIVED" ->
                "Yakındaki bir cihaz aldı; internete ulaşması bekleniyor."
            "SERVER_ACCEPTED" -> "Sunucuya ulaştı; operatör panelinde görünür."
            "OPERATOR_SEEN" -> "Operatör gördü."
            "CASE_IN_PROGRESS" -> "Vaka işlemde."
            "FAILED" -> "Gönderim başarısız; mesaj cihazda duruyor."
            "EXPIRED" -> "Mesaj süresi dolmadan iletilemedi."
            else -> state
        }
    }
}
