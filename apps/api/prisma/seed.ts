import { IncidentState, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-4000-8000-0000000000f0' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-0000000000f0',
      name: 'Demo Organization',
      slug: 'demo-org',
    },
  });

  const team = await prisma.team.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'demo-response-unit',
      zoneCode: 'SYNTH-Z1',
      organizationId: organization.id,
    },
  });

  const demoPassword = process.env.OPERATOR_DEMO_PASSWORD;
  let passwordHash: string | undefined;
  if (demoPassword) {
    passwordHash = await bcrypt.hash(demoPassword, 10);
  }

  await prisma.user.upsert({
    where: { email: 'operator-demo@sosmesh.example' },
    update: {
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: 'operator-demo@sosmesh.example',
      displayName: 'Demo Operator',
      role: 'OPERATOR',
      teamId: team.id,
      ...(passwordHash ? { passwordHash } : {}),
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

  await prisma.assignment.upsert({
    where: { id: '00000000-0000-4000-8000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000030',
      incidentId: incident.id,
      teamId: team.id,
      status: 'OPEN',
    },
  });

  const messageId = '00000000-0000-4000-8000-000000000020';
  // Synthetic demo coordinates (Ankara-ish grid); not real incident locations.
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
