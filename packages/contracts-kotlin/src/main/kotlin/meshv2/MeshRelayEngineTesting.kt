package com.sosmesh.contracts.meshv2

/** @internal Test-only configuration; not part of the public production API. */
internal data class MeshRelayEngineTestingConfig(
    val lruCapacity: Int,
    val skipTtlDecrement: Boolean = false,
    val skipDedupCheck: Boolean = false,
    val skipLoopGuard: Boolean = false,
    val skipMaxHopsCheck: Boolean = false,
) {
    fun toRuntime(): MeshRelayEngineRuntimeConfig =
        MeshRelayEngineRuntimeConfig(
            lruCapacity = lruCapacity,
            skipTtlDecrement = skipTtlDecrement,
            skipDedupCheck = skipDedupCheck,
            skipLoopGuard = skipLoopGuard,
            skipMaxHopsCheck = skipMaxHopsCheck,
        )
}

/** @internal Test-only factory visible to JVM unit tests in this module. */
internal object MeshRelayEngineTesting {
    fun create(config: MeshRelayEngineTestingConfig): MeshRelayEngine =
        MeshRelayEngine.fromTestingRuntime(config.toRuntime())
}
