import { getTestDatabaseUrl } from './helpers/database-url';

describe('PostgreSQL schema introspection (ADIM 17 deferred)', () => {
  it('has expected foreign keys and indexes after migrate', async () => {
    const databaseUrl = getTestDatabaseUrl();
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });

    try {
      const fkRows = await prisma.$queryRaw<
        { table_name: string; constraint_name: string }[]
      >`
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN (
            'sos_messages',
            'message_events',
            'relay_receipts',
            'ai_analyses',
            'assignments',
            'audit_logs'
          )
        ORDER BY tc.table_name, tc.constraint_name
      `;
      const fkTables = new Set(fkRows.map((row) => row.table_name));
      expect(fkTables.has('sos_messages')).toBe(true);
      expect(fkTables.has('message_events')).toBe(true);
      expect(fkTables.has('relay_receipts')).toBe(true);
      expect(fkTables.has('ai_analyses')).toBe(true);
      expect(fkTables.has('assignments')).toBe(true);

      const indexRows = await prisma.$queryRaw<
        { tablename: string; indexname: string }[]
      >`
        SELECT tablename, indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('sos_messages', 'message_events', 'operator_feed_events')
        ORDER BY tablename, indexname
      `;
      const indexNames = indexRows.map((row) => row.indexname);
      expect(indexNames.some((name) => name.includes('sos_messages_message_id'))).toBe(true);
      expect(indexNames.some((name) => name.includes('sos_messages_incident_id'))).toBe(
        true
      );
      expect(
        indexNames.some(
          (name) => name.includes('message_events') && name.includes('message_id')
        )
      ).toBe(true);
      expect(indexNames.some((name) => name.includes('operator_feed_events_message_id'))).toBe(
        true
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
