/**
 * Seed a SYSTEM_ADMIN user.
 *
 * Usage:
 *   node scripts/seedSystemAdmin.js
 *
 * Override via env vars: SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 */
require('../src/config/env');

const bcrypt = require('bcrypt');
const { eq, and, isNull } = require('drizzle-orm');
const { db } = require('../src/db/client');
const { users } = require('../src/db/schema/users');

const NAME = process.env.SEED_ADMIN_NAME || 'System Admin';
const EMAIL = (process.env.SEED_ADMIN_EMAIL || 'contact@dynease.in').toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'sagar@8897';

async function main() {
  // Check for an existing (non-deleted) user with this email
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, EMAIL), eq(users.is_deleted, false)))
    .limit(1);

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  if (existing) {
    // Update existing user to be a SYSTEM_ADMIN with the provided password
    const [updated] = await db
      .update(users)
      .set({
        user_type: 'SYSTEM_ADMIN',
        user_status: 'ACTIVE',
        password_hash: passwordHash,
        is_deleted: false,
        updatedat: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();

    console.log(`[Seed] Updated existing user ${updated.email} -> ${updated.user_type} (${updated.user_status}).`);
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({
      name: NAME,
      email: EMAIL,
      password_hash: passwordHash,
      user_type: 'SYSTEM_ADMIN',
      user_status: 'ACTIVE',
      sessionVersion: 0,
      is_deleted: false,
    })
    .returning();

  console.log(`[Seed] Created SYSTEM_ADMIN user: ${created.email} (id=${created.id}, status=${created.user_status}).`);
  return created;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Seed] Failed:', err);
    process.exit(1);
  });
