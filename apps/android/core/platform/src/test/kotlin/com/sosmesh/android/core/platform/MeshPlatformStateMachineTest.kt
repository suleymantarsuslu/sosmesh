package com.sosmesh.android.core.platform

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MeshPlatformStateMachineTest {
    private lateinit var machine: MeshPlatformStateMachine

    @Before
    fun setUp() {
        machine = MeshPlatformStateMachine()
    }

    @Test
    fun bluetoothDisabled_blocksRelayAndScan() {
        machine.reduce(MeshPlatformEvent.RelayOptIn)
        val evaluation = machine.reduce(MeshPlatformEvent.BluetoothDisabled)
        assertEquals(MeshOperationalMode.BLOCKED, evaluation.mode)
        assertEquals(MeshBlockReason.BLUETOOTH_OFF, evaluation.blockReason)
        assertEquals(PlatformUserHint.FIX_BLUETOOTH, evaluation.userHint)
        assertFalse(evaluation.radioProfile.scanningAllowed)
        assertFalse(evaluation.relayMayRun)
    }

    @Test
    fun permissionDenied_blocksRadio() {
        val evaluation = machine.reduce(MeshPlatformEvent.BlePermissionsDenied)
        assertEquals(MeshBlockReason.PERMISSION_DENIED, evaluation.blockReason)
        assertEquals(PlatformUserHint.FIX_PERMISSIONS, evaluation.userHint)
        assertFalse(evaluation.radioProfile.scanningAllowed)
    }

    @Test
    fun sosActive_keepsUrgentProfileWhenBluetoothOn() {
        machine.reduce(MeshPlatformEvent.SosTransferStarted)
        val evaluation = machine.currentEvaluation()
        assertEquals(MeshOperationalMode.SOS_ACTIVE, evaluation.mode)
        assertEquals(EnergyRadioProfile.SCAN_MODE_LOW_LATENCY, evaluation.radioProfile.scanMode)
        assertTrue(evaluation.radioProfile.scanningAllowed)
        assertEquals(5_000L, evaluation.radioProfile.scanPeriodMs)
    }

    @Test
    fun lowBattery_pausesRelayButNotSosTransfer() {
        machine.reduce(MeshPlatformEvent.RelayOptIn)
        machine.reduce(MeshPlatformEvent.BatteryLevelChanged(10))
        val relayEval = machine.currentEvaluation()
        assertEquals(MeshOperationalMode.BLOCKED, relayEval.mode)
        assertEquals(MeshBlockReason.BATTERY_CRITICAL, relayEval.blockReason)
        assertFalse(relayEval.relayMayRun)

        machine.reduce(MeshPlatformEvent.SosTransferStarted)
        val sosEval = machine.currentEvaluation()
        assertTrue(sosEval.radioProfile.scanningAllowed)
        assertEquals(EnergyRadioProfile.SCAN_MODE_LOW_LATENCY, sosEval.radioProfile.scanMode)
    }

    @Test
    fun networkLost_disablesRelayUploadButKeepsRelayMayRun() {
        machine.reduce(MeshPlatformEvent.RelayOptIn)
        machine.reduce(MeshPlatformEvent.NetworkLost)
        val evaluation = machine.currentEvaluation()
        assertTrue(evaluation.relayMayRun)
        assertFalse(evaluation.relayUploadMayRun)
        assertEquals(PlatformUserHint.NETWORK_OFFLINE_RELAY, evaluation.userHint)
    }

    @Test
    fun powerSaveAndDoze_selectsConstrainedProfile() {
        machine.reduce(MeshPlatformEvent.NetworkAvailable)
        machine.reduce(MeshPlatformEvent.RelayOptIn)
        machine.reduce(MeshPlatformEvent.PowerSaveEnabled)
        machine.reduce(MeshPlatformEvent.DeviceIdleEnter)
        val evaluation = machine.currentEvaluation()
        assertEquals(MeshOperationalMode.RELAY_ACTIVE, evaluation.mode)
        assertEquals(20_000L, evaluation.radioProfile.scanPeriodMs)
        assertEquals(PlatformUserHint.POWER_SAVE_CONSTRAINED, evaluation.userHint)
    }

    @Test
    fun transitionSequence_restoresRelayAfterBluetoothReturns() {
        machine.reduce(MeshPlatformEvent.RelayOptIn)
        machine.reduce(MeshPlatformEvent.BluetoothDisabled)
        assertFalse(machine.currentEvaluation().relayMayRun)
        val restored = machine.reduce(MeshPlatformEvent.BluetoothEnabled)
        assertTrue(restored.relayMayRun)
        assertEquals(MeshOperationalMode.RELAY_ACTIVE, restored.mode)
    }
}
