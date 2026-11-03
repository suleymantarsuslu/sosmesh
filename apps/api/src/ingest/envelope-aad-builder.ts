/**
 * Envelope AAD Builder
 * 
 * Extracts the exact envelope fields used by iOS and Android clients for encryption AAD.
 * The clients encrypt with: { timestamp, locationStatus, location, priority }
 * where location is null (not omitted) when absent.
 * 
 * This utility ensures the server uses the SAME AAD structure for decryption.
 */

export interface ClientEnvelopeAad {
  timestamp: string;
  locationStatus: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  priority: number;
}

/**
 * Extracts client-side AAD fields from a wire envelope.
 * 
 * The wire envelope may contain extra fields like ackLevel and relayCount
 * that are NOT part of the encryption AAD. This function extracts only
 * the fields the clients use for encryption.
 * 
 * @param wireEnvelope - The full envelope object from the wire protocol
 * @returns The envelope object matching client encryption AAD shape
 */
export function extractClientAad(wireEnvelope: Record<string, unknown>): ClientEnvelopeAad {
  const timestamp = String(wireEnvelope.timestamp ?? '');
  const locationStatus = String(wireEnvelope.locationStatus ?? 'UNKNOWN');
  const priority = typeof wireEnvelope.priority === 'number' ? wireEnvelope.priority : 1;

  // Extract location object or null
  let location: ClientEnvelopeAad['location'] = null;
  if (wireEnvelope.location && typeof wireEnvelope.location === 'object') {
    const loc = wireEnvelope.location as Record<string, unknown>;
    const latitude = typeof loc.latitude === 'number' ? loc.latitude : null;
    const longitude = typeof loc.longitude === 'number' ? loc.longitude : null;

    if (latitude !== null && longitude !== null) {
      location = {
        latitude,
        longitude,
      };

      // Include accuracy if present (optional field)
      if (typeof loc.accuracy === 'number') {
        location.accuracy = loc.accuracy;
      }
    }
  }

  return {
    timestamp,
    locationStatus,
    location,
    priority,
  };
}

/**
 * Detects if a stored AAD is the old whole-envelope format (contains ackLevel or relayCount).
 * Old format should be migrated on-the-fly during decryption.
 * 
 * @param storedAadJson - The stored originalEnvelopeAad JSON string
 * @returns true if the AAD contains fields that should not be there
 */
export function isLegacyWholeEnvelopeAad(storedAadJson: string): boolean {
  try {
    const parsed = JSON.parse(storedAadJson);
    return 'ackLevel' in parsed || 'relayCount' in parsed;
  } catch {
    return false;
  }
}

/**
 * Extracts client AAD from a legacy stored envelope that includes extra fields.
 * 
 * @param legacyAadJson - The stored originalEnvelopeAad with extra fields
 * @returns The client AAD extracted from the legacy format
 */
export function extractClientAadFromLegacy(legacyAadJson: string): ClientEnvelopeAad | null {
  try {
    const parsed = JSON.parse(legacyAadJson);
    return extractClientAad(parsed);
  } catch {
    return null;
  }
}
