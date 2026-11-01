package com.sosmesh.contracts.meshv2

/** Public production entry point for mesh relay engines (guards always enabled). */
object MeshRelayEngineFactory {
    fun createRelayEngine(lruCapacity: Int): MeshRelayEngine =
        MeshRelayEngine(MeshRelayEngineConfig(lruCapacity = lruCapacity))
}
