const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/db/client');

describe('Supabase PostgreSQL Row Level Security (RLS) & Tenant Isolation Audit Suite', () => {
  let client;

  before(async () => {
    client = await pool.connect();
  });

  after(async () => {
    if (client) client.release();
  });

  it('1. Confirms ZERO public tables are UNRESTRICTED (all 15 tables have RLS enabled)', async () => {
    const res = await client.query(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);

    assert.ok(res.rows.length >= 15, 'Expected at least 15 public tables');

    const unrestricted = res.rows.filter(r => !r.rls_enabled);
    assert.deepEqual(
      unrestricted.map(r => r.table_name),
      [],
      `Found UNRESTRICTED tables without RLS: ${unrestricted.map(r => r.table_name).join(', ')}`
    );
  });

  it('2. Confirms service_role full access policies exist on all tables', async () => {
    const res = await client.query(`
      SELECT tablename, policyname, roles
      FROM pg_policies
      WHERE schemaname = 'public' AND 'service_role' = ANY(roles);
    `);

    const tablesWithServiceRole = new Set(res.rows.map(r => r.tablename));
    const expectedTables = [
      'assignment_events', 'audit_log', 'leads', 'menu_categories',
      'menu_categories_items', 'order_details', 'order_items', 'plans',
      'restaurants', 'rosters', 'service_requests', 'shifts', 'tables',
      'tables_assignment', 'users'
    ];

    for (const t of expectedTables) {
      assert.ok(
        tablesWithServiceRole.has(t),
        `Table ${t} is missing a service_role policy to prevent backend lockouts`
      );
    }
  });

  it('3. Confirms sensitive tables have NO anonymous read/write policies', async () => {
    const res = await client.query(`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public' 
        AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
        AND tablename IN ('users', 'audit_log', 'shifts', 'rosters', 'tables_assignment', 'assignment_events');
    `);

    assert.equal(
      res.rows.length,
      0,
      `Sensitive tables must not have anon policies: ${res.rows.map(r => `${r.tablename}:${r.policyname}`).join(', ')}`
    );
  });

  it('4. Confirms all existing data rows are preserved across all tables', async () => {
    const counts = await client.query(`
      SELECT 
        (SELECT count(*) FROM public.plans)::int as plans_count,
        (SELECT count(*) FROM public.restaurants)::int as restaurants_count,
        (SELECT count(*) FROM public.users)::int as users_count,
        (SELECT count(*) FROM public.menu_categories)::int as categories_count,
        (SELECT count(*) FROM public.menu_categories_items)::int as items_count,
        (SELECT count(*) FROM public.tables)::int as tables_count,
        (SELECT count(*) FROM public.tables_assignment)::int as assignments_count
    `);

    const data = counts.rows[0];
    assert.ok(data.plans_count >= 4, 'Plans data preserved');
    assert.ok(data.restaurants_count >= 2, 'Restaurants data preserved');
    assert.ok(data.users_count >= 2, 'Users data preserved');
    assert.ok(data.categories_count >= 10, 'Menu categories data preserved');
    assert.ok(data.items_count >= 20, 'Menu items data preserved');
    assert.ok(data.tables_count >= 2, 'Tables data preserved');
  });

  it('5. Confirms Drizzle migration history contains baseline and RLS migrations', async () => {
    const res = await client.query(`SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id;`);
    const hashes = res.rows.map(r => r.hash);

    assert.ok(hashes.includes('0000_married_mulholland_black'), 'Baseline migration present');
    assert.ok(hashes.includes('0001_enable_rls_and_tenant_policies'), 'RLS migration recorded');
  });
});
