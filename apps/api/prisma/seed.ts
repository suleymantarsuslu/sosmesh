import { IncidentState, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const team = await prisma.team.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'demo-response-unit',
      zoneCode: 'SYNTH-Z1',
    },
  });

  await prisma.user.upsert({
    where: { email: 'operator-demo@sosmesh.invalid' },
    update: {},
    create: {
      email: 'operator-demo@sosmesh.invalid',
      displayName: 'Demo Operator',
      role: 'OPERATOR',
      teamId: team.id,
    },
  });

  const incident = await prisma.incident.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: { state: IncidentState.PENDING },
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      state: IncidentState.PENDING,
    },
  });

  const messageId = '00000000-0000-4000-8000-000000000020';
  await prisma.sosMessage.upsert({
    where: { messageId },
    update: {},
    create: {
      messageId,
      incidentId: incident.id,
      locationStatus: 'UNKNOWN',
      priority: 2,
      encryptedNoteBlob: 'opaque-ciphertext-demo-no-pii',
      latitude: 39.925,
      longitude: 32.836,
      accuracyMeters: 500,
    },
  });

  await prisma.auditLog.create({
    data: {
      incidentId: incident.id,
      action: 'SEED_DEMO',
      detailsJson: { synthetic: true },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
