require('../config/env');
const { pool } = require('./client');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[Migration] Starting reviewed migration: 0001_role_workflows...');

    // 1. Enums
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."restaurant_status" ADD VALUE IF NOT EXISTS 'PENDING';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."restaurant_status" ADD VALUE IF NOT EXISTS 'REJECTED';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. Order status enum values
    const orderStatuses = ['PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED', 'PAID'];
    for (const st of orderStatuses) {
      await client.query(`
        DO $$ BEGIN
          ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS '${st}';
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);
    }

    // 3. Columns
    await client.query(`
      ALTER TABLE "public"."restaurants" 
      ADD COLUMN IF NOT EXISTS "rejection_reason" text;
    `);

    // 4. plan_requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "public"."plan_requests" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "restaurant_id" uuid NOT NULL REFERENCES "public"."restaurants"("id") ON DELETE CASCADE,
        "plan_id" uuid NOT NULL REFERENCES "public"."plans"("id"),
        "billing_cycle" varchar(50) DEFAULT 'monthly' NOT NULL,
        "status" varchar(50) DEFAULT 'PENDING' NOT NULL,
        "requested_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
        "rejection_reason" text,
        "createdat" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedat" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "plan_requests_restaurant_idx" 
      ON "public"."plan_requests" ("restaurant_id");
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "plan_requests_status_idx" 
      ON "public"."plan_requests" ("status");
    `);

    console.log('[Migration] Migration 0001_role_workflows completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
