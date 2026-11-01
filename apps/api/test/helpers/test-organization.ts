import { PrismaClient } from '@prisma/client';

const DEFAULT_ORG_ID = '00000000-0000-4000-8000-0000000000f0';

export async function ensureDefaultOrganization(prisma: PrismaClient): Promise<string> {
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: 'Test Organization',
      slug: 'test-org-default',
    },
  });
  return DEFAULT_ORG_ID;
}

export async function createTestOrganization(
  prisma: PrismaClient,
  params: { id: string; name: string; slug: string }
): Promise<void> {
  await prisma.organization.create({
    data: {
      id: params.id,
      name: params.name,
      slug: params.slug,
    },
  });
}
