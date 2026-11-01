package com.sosmesh.android.core.ble

import com.sosmesh.android.core.ble.platform.GattCharacteristicSpec
import com.sosmesh.android.core.ble.platform.GattProperty
import com.sosmesh.android.core.ble.platform.GattServerPort

class GattServer(
    private val serverPort: GattServerPort,
) {
    private val characteristics: List<GattCharacteristicSpec> =
        listOf(
            GattCharacteristicSpec(BleMeshConstants.CONTROL_CHAR_UUID, setOf(GattProperty.READ, GattProperty.WRITE)),
            GattCharacteristicSpec(BleMeshConstants.DATA_CHAR_UUID, setOf(GattProperty.WRITE)),
            GattCharacteristicSpec(
                BleMeshConstants.ACK_CHAR_UUID,
                setOf(GattProperty.READ, GattProperty.WRITE, GattProperty.NOTIFY),
            ),
        )

    fun start(): Result<Unit> = serverPort.start(BleMeshConstants.SERVICE_UUID, characteristics)

    fun stop() {
        serverPort.stop()
    }
}
