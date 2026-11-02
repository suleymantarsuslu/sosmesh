import {
  runMigrationDown,
  runPrismaMigrateDeploy,
  countPublicTables,
} from './helpers/embedded-postgres';
import { getTestDatabaseUrl } from './helpers/database-url';

describe('Prisma migration up/down/up', () => {
  it('applies up, rolls back down, and applies up again', async () => {
    const databaseUrl = getTestDatabaseUrl();
    const afterUp = await countPublicTables(databaseUrl);
    expect(afterUp).toBe(19);

    runMigrationDown(databaseUrl);
    const afterDown = await countPublicTables(databaseUrl);
    expect(afterDown).toBe(0);

    runPrismaMigrateDeploy(databaseUrl);
    const afterSecondUp = await countPublicTables(databaseUrl);
    expect(afterSecondUp).toBe(19);
  });
});
