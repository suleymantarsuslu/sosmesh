/**
 * Test-only mesh relay engine factory. Not exported from package index or package.json exports.
 * @internal
 */
import {
  MeshRelayEngine,
  type MeshRelayEngineConfig,
  meshRelayEngineFromInternalRuntime,
} from './mesh-relay-engine';

export type MeshRelayEngineTestingConfig = MeshRelayEngineConfig & {
  skipTtlDecrement?: boolean;
  skipDedupCheck?: boolean;
  skipLoopGuard?: boolean;
  skipMaxHopsCheck?: boolean;
};

export function createMeshRelayEngineForTesting(
  config: MeshRelayEngineTestingConfig
): MeshRelayEngine {
  return meshRelayEngineFromInternalRuntime({
    lruCapacity: config.lruCapacity,
    skipTtlDecrement: config.skipTtlDecrement ?? false,
    skipDedupCheck: config.skipDedupCheck ?? false,
    skipLoopGuard: config.skipLoopGuard ?? false,
    skipMaxHopsCheck: config.skipMaxHopsCheck ?? false,
  });
}
