import { Pool } from "pg";
const pool = new Pool({
  connectionString: "postgresql://postgres.uqzhdbxheekicjrgyiee:%7DmE8.KPv%7DFdqFx8@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
});

async function run() {
  const client = await pool.connect();
  try {
    // Create CommunicationTemplate table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CommunicationTemplate" (
        "id" TEXT NOT NULL,
        "workshopId" TEXT NOT NULL,
        "templateKey" TEXT NOT NULL,
        "channel" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CommunicationTemplate_workshopId_templateKey_channel_key" UNIQUE ("workshopId", "templateKey", "channel")
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationTemplate_workshopId_idx" ON "CommunicationTemplate"("workshopId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationTemplate_templateKey_idx" ON "CommunicationTemplate"("templateKey");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationTemplate_channel_idx" ON "CommunicationTemplate"("channel");`);
    await client.query(`
      ALTER TABLE "CommunicationTemplate"
      DROP CONSTRAINT IF EXISTS "CommunicationTemplate_workshopId_fkey",
      ADD CONSTRAINT "CommunicationTemplate_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // Create CommunicationLog table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "CommunicationLog" (
        "id" TEXT NOT NULL,
        "workshopId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "recipient" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "templateKey" TEXT,
        "entityType" TEXT,
        "entityId" TEXT,
        "providerId" TEXT,
        "errorMessage" TEXT,
        "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationLog_workshopId_idx" ON "CommunicationLog"("workshopId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationLog_type_idx" ON "CommunicationLog"("type");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationLog_status_idx" ON "CommunicationLog"("status");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationLog_templateKey_idx" ON "CommunicationLog"("templateKey");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationLog_entityType_entityId_idx" ON "CommunicationLog"("entityType", "entityId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "CommunicationLog_sentAt_idx" ON "CommunicationLog"("sentAt");`);
    await client.query(`
      ALTER TABLE "CommunicationLog"
      DROP CONSTRAINT IF EXISTS "CommunicationLog_workshopId_fkey",
      ADD CONSTRAINT "CommunicationLog_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    console.log("CommunicationTemplate and CommunicationLog tables created successfully");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
