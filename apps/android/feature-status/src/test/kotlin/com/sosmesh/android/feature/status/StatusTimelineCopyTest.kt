package com.sosmesh.android.feature.status

import com.sosmesh.android.core.data.sos.DeliveryTimelineLabels
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33], qualifiers = "tr")
class StatusTimelineCopyTest {
    private val forbidden =
        listOf(
            "ekibe ulaştı",
            "yardım yolda",
            "kurtarma ekibi gördü",
            "operatör okudu",
            "delivered to rescue",
            "help is on the way",
        )

    @Test
    fun timelineStrings_matchDeliveryTimelineLabels_tr() {
        assertEquals(DeliveryTimelineLabels.LOCAL_SAVED_TR, string(R.string.status_timeline_step_1))
        assertEquals(DeliveryTimelineLabels.PEER_RECEIVED_TR, string(R.string.status_timeline_step_2))
        assertEquals(DeliveryTimelineLabels.SERVER_ACCEPTED_TR, string(R.string.status_timeline_step_3))
        assertEquals(DeliveryTimelineLabels.OPERATOR_SEEN_TR, string(R.string.status_timeline_step_4))
        assertEquals(DeliveryTimelineLabels.CASE_IN_PROGRESS_TR, string(R.string.status_timeline_step_5))
    }

    @Test
    fun timelineStrings_containNoForbiddenPhrases() {
        val strings =
            listOf(
                string(R.string.status_timeline_step_1),
                string(R.string.status_timeline_step_2),
                string(R.string.status_timeline_step_3),
                string(R.string.status_timeline_step_4),
                string(R.string.status_timeline_step_5),
                string(R.string.status_timeline_desc_local),
                string(R.string.status_timeline_desc_peer),
                string(R.string.status_timeline_desc_server),
                string(R.string.status_timeline_desc_operator),
                string(R.string.status_timeline_desc_case),
                string(R.string.status_not112_disclaimer),
            )
        strings.forEach { value ->
            forbidden.forEach { bad ->
                assertFalse(
                    "Forbidden phrase '$bad' in '$value'",
                    value.lowercase().contains(bad.lowercase()),
                )
            }
        }
    }

    private fun string(id: Int): String = org.robolectric.RuntimeEnvironment.getApplication().getString(id)
}
