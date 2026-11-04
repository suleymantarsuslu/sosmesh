import type { PrismaService } from '../prisma/prisma.service';
import { computeAddressAssumption, type AddressAssumption } from './address-assumption';
import type { SenderProfileV2 } from './inner-payload-v2';
import { ProfileCrypto } from './profile-crypto';

export type CaseSenderView = {
  /** Decrypted latest profile; only ever returned to authenticated operators allowed on the incident. */
  profile: SenderProfileV2 | null;
  /** Inference only (labelled "Varsayım / Assumption" in the panel); never dispatches. */
  assumption: AddressAssumption | null;
  mergedMessageCount: number;
  mergedMessages: {
    messageId: string;
    receivedAt: string;
    hasNote: boolean;
    hasLocation: boolean;
    personCount: number | null;
  }[];
};

const profileCrypto = new ProfileCrypto();

/** Mesh v2 sender block for the case detail; null for v1 incidents (no sender). */
export async function buildCaseSenderView(prisma: PrismaService, incidentId: string): Promise<CaseSenderView | null> {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: {
      senderId: true,
      mergedMessageCount: true,
      latestLatitude: true,
      latestLongitude: true,
      latestAccuracyMeters: true,
      sender: { select: { profile: { select: { ciphertext: true } } } },
      sosMessages: {
        orderBy: { receivedAt: 'desc' },
        take: 50,
        select: {
          messageId: true,
          receivedAt: true,
          noteText: true,
          encryptedNoteBlob: true,
          preciseLatitude: true,
          personCount: true,
        },
      },
    },
  });
  if (!incident?.senderId) {
    return null;
  }
  const ciphertext = incident.sender?.profile?.ciphertext;
  const profile = ciphertext ? profileCrypto.decrypt(incident.senderId, ciphertext) : null;
  const newestPersonCount = incident.sosMessages.find((m) => m.personCount !== null)?.personCount ?? null;
  const location =
    incident.latestLatitude && incident.latestLongitude
      ? {
          latitude: incident.latestLatitude.toNumber(),
          longitude: incident.latestLongitude.toNumber(),
          accuracyMeters: incident.latestAccuracyMeters ?? undefined,
        }
      : null;
  return {
    profile,
    assumption: computeAddressAssumption(location, profile, newestPersonCount),
    mergedMessageCount: incident.mergedMessageCount,
    mergedMessages: incident.sosMessages.map((m) => ({
      messageId: m.messageId,
      receivedAt: m.receivedAt.toISOString(),
      hasNote: Boolean(m.noteText),
      hasLocation: m.preciseLatitude !== null,
      personCount: m.personCount,
    })),
  };
}
