package com.sosmesh.contracts.crossplatform

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.nio.file.Files
import java.nio.file.Paths

class CrossPlatformAckGateFixtureTest {
    private val json = Json { ignoreUnknownKeys = true }

    @TestFactory
    fun transfer_ack_gate_fixture_cases(): List<DynamicTest> {
        val vectorsPath =
            Paths.get(
                System.getProperty("user.dir"),
                "..",
                "fixtures",
                "cross-platform",
                "transfer-ack-gate.json",
            ).normalize()
        val root = json.parseToJsonElement(Files.readString(vectorsPath)).jsonObject
        val cases = root.getValue("cases").jsonArray

        return cases.map { element ->
            val case = element.jsonObject
            val id = case.getValue("id").jsonPrimitive.content
            DynamicTest.dynamicTest(id) {
                val input = case.getValue("input").jsonObject
                val expect = case.getValue("expect").jsonObject

                if (input.containsKey("crcValid")) {
                    val result =
                        CrossPlatformAckDeliveryGate.evaluateTransfer(
                            AckGateTransferInput(
                                crcValid = input.getValue("crcValid").jsonPrimitive.content.toBooleanStrict(),
                                digestValid = input.getValue("digestValid").jsonPrimitive.content.toBooleanStrict(),
                                chunkAcksComplete =
                                    input.getValue("chunkAcksComplete").jsonPrimitive.content.toBooleanStrict(),
                                transferVerified =
                                    input.getValue("transferVerified").jsonPrimitive.content.toBooleanStrict(),
                            ),
                        )
                    assertEquals(
                        expect.getValue("mayEmitPeerReceived").jsonPrimitive.content.toBooleanStrict(),
                        result.mayEmitPeerReceived,
                    )
                    assertEquals(
                        expect.getValue("mayEmitServerAccepted").jsonPrimitive.content.toBooleanStrict(),
                        result.mayEmitServerAccepted,
                    )
                    val reject = expect["rejectReason"]?.jsonPrimitive?.content
                    if (reject != null && reject != "null") {
                        assertEquals(reject, result.rejectReason?.name)
                    }
                }

                if (input.containsKey("deliveryState")) {
                    val state =
                        CrossPlatformAckDeliveryGate.evaluateDeliveryState(
                            input.getValue("deliveryState").jsonPrimitive.content,
                        )
                    expect["mayEmitPeerReceived"]?.jsonPrimitive?.content?.let { expected ->
                        assertEquals(expected.toBooleanStrict(), state.mayEmitPeerReceived)
                    }
                    expect["mayEmitServerAccepted"]?.jsonPrimitive?.content?.let { expected ->
                        assertEquals(expected.toBooleanStrict(), state.mayEmitServerAccepted)
                    }
                    expect["allowedNextStates"]?.jsonArray?.let { expected ->
                        assertEquals(
                            expected.map { it.jsonPrimitive.content },
                            state.allowedNextStates,
                        )
                    }
                    expect["forbiddenNextStates"]?.jsonArray?.let { expected ->
                        for (forbidden in expected) {
                            assertTrue(state.forbiddenNextStates.contains(forbidden.jsonPrimitive.content))
                        }
                    }
                }
            }
        }
    }

    @Test
    fun mutation_chunk_ack_only_differs_from_production_gate() {
        val input =
            AckGateTransferInput(
                crcValid = true,
                digestValid = true,
                chunkAcksComplete = true,
                transferVerified = false,
            )
        assertFalse(CrossPlatformAckDeliveryGate.evaluateTransfer(input).mayEmitPeerReceived)
        assertTrue(CrossPlatformAckDeliveryGate.peerReceivedIfIgnoringVerified(input))
    }
}
