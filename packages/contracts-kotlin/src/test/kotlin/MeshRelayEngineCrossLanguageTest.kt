package com.sosmesh.contracts.meshv2

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory
import java.nio.file.Files
import java.nio.file.Paths

class MeshRelayEngineCrossLanguageTest {
    private val json = Json { ignoreUnknownKeys = true }

    @TestFactory
    fun cross_language_vectors_match_golden(): List<DynamicTest> {
        val vectorsPath =
            Paths.get(
                System.getProperty("user.dir"),
                "..",
                "contracts",
                "protocol-v2",
                "vectors",
                "relay-engine-cases.json",
            ).normalize()
        val root = json.parseToJsonElement(Files.readString(vectorsPath)).jsonObject
        val cases = root.getValue("cases").jsonArray

        return cases.map { element ->
            val case = element.jsonObject
            val id = case.getValue("id").jsonPrimitive.content
            DynamicTest.dynamicTest(id) {
                val relayHash = case.getValue("relayDeviceIdHash").jsonPrimitive.content
                val envelope =
                    json.decodeFromJsonElement(
                        MeshRelayEnvelopeV2.serializer(),
                        case.getValue("envelope"),
                    )
                val expect = case.getValue("expect").jsonObject
                val engine = MeshRelayEngine(MeshRelayEngineConfig(lruCapacity = 256))
                val preSeen = case["previouslySeenDedupKey"]?.jsonPrimitive?.content
                if (preSeen != null) {
                    engine.seedDedupKey(preSeen)
                }
                val outcome = engine.evaluateForward(envelope, relayHash)
                assertEquals(expect.getValue("decision").jsonPrimitive.content, outcome.decision.name)
                val dropReason = expect["dropReason"]?.jsonPrimitive?.content
                if (dropReason != null) {
                    assertEquals(dropReason, outcome.dropReason?.name)
                }
                if (outcome.decision == MeshRelayDecision.FORWARD) {
                    val forward = requireNotNull(outcome.forward)
                    assertEquals(expect.getValue("forwardHopCount").jsonPrimitive.content.toInt(), forward.hopCount)
                    assertEquals(expect.getValue("forwardTtlHops").jsonPrimitive.content.toInt(), forward.ttlHops)
                    assertEquals(
                        expect.getValue("forwardCopyCount").jsonPrimitive.content.toInt(),
                        forward.copyCount,
                    )
                }
            }
        }
    }
}
