export function isDisasterReadOnlyModeEnabled(): boolean {
  return process.env.SOSMESH_DISASTER_READ_ONLY_MODE === 'true';
}
