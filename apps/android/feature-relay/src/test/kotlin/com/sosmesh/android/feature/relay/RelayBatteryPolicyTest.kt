package com.sosmesh.android.feature.relay

import com.sosmesh.android.feature.relay.battery.RelayBatteryPolicy
import com.sosmesh.android.feature.relay.battery.RelayBatterySnapshot
import com.sosmesh.android.feature.relay.battery.RelayPauseReason
import com.sosmesh.android.feature.relay.settings.RelayHourlyDataBudget
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class RelayBatteryPolicyTest {
    private lateinit var settings: MutableRelaySettings
    private lateinit var budget: RelayHourlyDataBudget
    private lateinit var policy: RelayBatteryPolicy

    @Before
    fun setUp() {
        settings = MutableRelaySettings(relayEnabled = true, batteryThreshold = 20)
        budget =
            RelayHourlyDataBudget(
                androidx.test.core.app.ApplicationProvider.getApplicationContext(),
            )
        budget.resetForTests()
        policy = RelayBatteryPolicy(settings, budget)
    }

    @Test
    fun toggleOff_doesNotRunRelay() {
        settings.relayEnabled = false
        val eval =
            policy.evaluate(
                RelayBatterySnapshot(50, isCharging = false),
                relayEnabled = settings.isRelayEnabled(),
                nowMs = 1_000L,
            )
        assertFalse(eval.mayRunRelay)
        assertEquals(RelayPauseReason.UserDisabled, eval.pauseReason)
    }

    @Test
    fun batteryBelowThreshold_pausesUnlessCharging() {
        val low =
            policy.evaluate(
                RelayBatterySnapshot(10, isCharging = false),
                relayEnabled = true,
                nowMs = 1_000L,
            )
        assertFalse(low.mayRunRelay)
        assertEquals(RelayPauseReason.BatteryBelowThreshold, low.pauseReason)

        val charging =
            policy.evaluate(
                RelayBatterySnapshot(10, isCharging = true),
                relayEnabled = true,
                nowMs = 1_000L,
            )
        assertTrue(charging.mayRunRelay)
        assertEquals(null, charging.pauseReason)
    }

    @Test
    fun hourlyLimit_defersUploadWhenPayloadTooLarge() {
        val limit = 64 * 1024L
        settings.hourlyLimitBytes = limit
        budget.recordSent((limit - 100).toInt(), 1_000L)
        val eval =
            policy.evaluate(
                RelayBatterySnapshot(80, isCharging = false),
                relayEnabled = true,
                nowMs = 2_000L,
                nextUploadPayloadBytes = 200,
            )
        assertTrue(eval.mayRunRelay)
        assertEquals(RelayPauseReason.HourlyDataLimit, eval.pauseReason)
    }
}
