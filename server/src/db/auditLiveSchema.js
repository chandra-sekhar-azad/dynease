const { pool } = require('./client');

async function audit() {
  const client = await pool.connect();
  try {
    console.log('--- DB SESSION INFO ---');
    const sessionRes = await client.query('SELECT current_user, session_user, current_database(), version();');
    console.log(sessionRes.rows[0]);

    console.log('\n--- PUBLIC TABLES & RLS STATUS (UNRESTRICTED AUDIT) ---');
    const tablesRes = await client.query(`
      SELECT 
        c.relname as table_name,
        c.relrowsecurity as rls_enabled,
        c.relforcerowsecurity as rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `);

    for (const row of tablesRes.rows) {
      const countRes = await client.query(`SELECT count(*)::int as count FROM public."${row.table_name}"`);
      const status = row.rls_enabled ? (row.rls_forced ? 'RESTRICTED (FORCED)' : 'RESTRICTED') : 'UNRESTRICTED';
      console.log(`Table: ${row.table_name.padEnd(25)} | RLS: ${status.padEnd(15)} | Rows: ${countRes.rows[0].count}`);
    }

    console.log('\n--- EXISTING ROW LEVEL SECURITY POLICIES ---');
    const polRes = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    console.log(`Total Policies: ${polRes.rows.length}`);
    for (const p of polRes.rows) {
      console.log(`- [${p.tablename}] "${p.policyname}" | CMD: ${p.cmd} | Roles: ${p.roles} | Permissive: ${p.permissive}`);
    }

    console.log('\n--- FOREIGN KEY CONSTRAINTS & RESTAURANT_ID COLUMNS ---');
    const fksRes = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    for (const fk of fksRes.rows) {
      console.log(`FK: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    }

    console.log('\n--- DRIZZLE MIGRATION HISTORY TABLE ---');
    const migCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) as exists;
    `);
    if (migCheck.rows[0].exists) {
      const migs = await client.query(`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;`);
      console.log('Drizzle migrations recorded:', migs.rows);
    } else {
      console.log('No drizzle.__drizzle_migrations table found.');
    }

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

audit();
