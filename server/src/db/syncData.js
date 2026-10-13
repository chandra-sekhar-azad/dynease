require('../config/env');
const path = require('path');
const { Pool } = require('pg');

async function syncData() {
  const renderPool = new Pool({
    connectionString: 'postgresql://dynease:RZvji8aR620WStxjCTB4EUdD69oG1kfF@dpg-darb8dqd0e5s73e35hfg-a.oregon-postgres.render.com/campusfix_3tgs?sslmode=require',
    ssl: { rejectUnauthorized: false }
  });
  const supabasePool = new Pool({
    connectionString: process.env.SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('--- 1. Seeding canonical plans into Supabase ---');
  const { PLANS } = require('../config/plans');
  for (const key of Object.keys(PLANS)) {
    const p = PLANS[key];
    await supabasePool.query(`
      INSERT INTO plans (id, name, configuration, plan_status, is_deleted)
      VALUES ($1, $2, $3, 'ACTIVE', false)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        configuration = EXCLUDED.configuration,
        plan_status = EXCLUDED.plan_status;
    `, [
      p.planId,
      p.name,
      JSON.stringify({ limits: p.limits, features: p.features, pricing: { monthly: p.monthlyPricePaise, yearly: p.yearlyPricePaise } })
    ]);
  }
  console.log('Plans seeded successfully.');

  console.log('--- 2. Transferring restaurants from Render to Supabase ---');
  const regRes = await renderPool.query('SELECT * FROM dynease_restaurant_registries');
  const profRes = await renderPool.query('SELECT * FROM dynease_restaurant_profiles');
  const profMap = {};
  profRes.rows.forEach(p => { profMap[p.restaurant_id] = p; });

  for (const r of regRes.rows) {
    const p = profMap[r.restaurant_id] || {};
    const planId = (r.selected_plan === 'GROWTH' || r.selected_plan === 'BUSINESS' || r.selected_plan === 'PRO') ? r.selected_plan : 'STARTER';
    await supabasePool.query(`
      INSERT INTO restaurants (
        id, name, address, phone_number, restaurant_status, plan_id, domain, table_allocation_mode, is_deleted, createdat, updatedat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        domain = EXCLUDED.domain,
        restaurant_status = EXCLUDED.restaurant_status;
    `, [
      r.restaurant_id,
      r.restaurant_name,
      JSON.stringify(p.address || {}),
      r.owner_phone || p.phone,
      r.status === 'ACTIVE' ? 'ACTIVE' : (r.status === 'PAUSED' ? 'PAUSED' : 'INACTIVE'),
      planId,
      r.subdomain,
      'MANUAL',
      false,
      r.created_at || new Date(),
      r.updated_at || new Date()
    ]);
  }
  console.log(`Transferred ${regRes.rows.length} restaurants.`);

  console.log('--- 3. Transferring users from Render to Supabase ---');
  const usersRes = await renderPool.query('SELECT * FROM dynease_users');
  for (const u of usersRes.rows) {
    const checkRest = await supabasePool.query('SELECT id FROM restaurants WHERE id = $1', [u.restaurant_id]);
    if (checkRest.rows.length === 0) continue;

    const userType = (u.role === 'SUPER_ADMIN' || u.role === 'RESTAURANT_OWNER' || u.role === 'ADMIN') ? 'ADMIN' : 'STAFF';
    await supabasePool.query(`
      INSERT INTO users (
        id, name, email, password, phone_number, restaurant_id, user_type, user_status, "sessionVersion", is_deleted, createdat, updatedat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, false, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        user_status = EXCLUDED.user_status;
    `, [
      u.id,
      u.name,
      u.email.toLowerCase(),
      u.password,
      u.phone,
      u.restaurant_id,
      userType,
      u.is_active ? 'ACTIVE' : 'INACTIVE',
      u.created_at || new Date(),
      u.updated_at || new Date()
    ]);
  }
  console.log('Users transferred successfully.');

  console.log('--- 4. Transferring categories and menu items ---');
  const catRes = await renderPool.query('SELECT * FROM dynease_categories');
  for (const c of catRes.rows) {
    const checkRest = await supabasePool.query('SELECT id FROM restaurants WHERE id = $1', [c.restaurant_id]);
    if (checkRest.rows.length === 0) continue;
    await supabasePool.query(`
      INSERT INTO menu_categories (
        id, restaurant_id, category, display_order, menu_category_status, is_deleted, createdat, updatedat
      ) VALUES ($1, $2, $3, $4, $5, false, $6, $7)
      ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category;
    `, [
      c.id,
      c.restaurant_id,
      c.name,
      c.display_order || 0,
      c.is_active ? 'ACTIVE' : 'INACTIVE',
      c.created_at || new Date(),
      c.updated_at || new Date()
    ]);
  }
  console.log(`Categories transferred: ${catRes.rows.length}`);

  const itemRes = await renderPool.query('SELECT * FROM dynease_menu_items');
  for (const it of itemRes.rows) {
    const checkRest = await supabasePool.query('SELECT id FROM restaurants WHERE id = $1', [it.restaurant_id]);
    if (checkRest.rows.length === 0) continue;
    let catId = it.category_id;
    if (catId) {
      const cCheck = await supabasePool.query('SELECT id FROM menu_categories WHERE id = $1', [catId]);
      if (cCheck.rows.length === 0) catId = null;
    }
    if (!catId) {
      const cFind = await supabasePool.query('SELECT id FROM menu_categories WHERE restaurant_id = $1 AND LOWER(category) = LOWER($2)', [it.restaurant_id, it.category]);
      if (cFind.rows.length > 0) catId = cFind.rows[0].id;
    }
    if (!catId) continue;

    await supabasePool.query(`
      INSERT INTO menu_categories_items (
        id, restaurant_id, category_id, menu_item_status, menu_item_type, name, item_size, description, price, preparation_time, is_deleted, createdat, updatedat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, $11, $12)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;
    `, [
      it.id,
      it.restaurant_id,
      catId,
      it.is_available ? 'AVAILABLE' : 'UNAVAILABLE',
      it.dietary_preference === 'NON_VEG' ? 'NON_VEG' : 'VEG',
      it.name,
      'MEDIUM',
      it.description || '',
      it.price || 0,
      it.preparation_time || 15,
      it.created_at || new Date(),
      it.updated_at || new Date()
    ]);
  }
  console.log(`Menu items transferred: ${itemRes.rows.length}`);

  console.log('--- 5. Transferring tables ---');
  const tblRes = await renderPool.query('SELECT * FROM dynease_tables');
  for (const t of tblRes.rows) {
    const checkRest = await supabasePool.query('SELECT id FROM restaurants WHERE id = $1', [t.restaurant_id]);
    if (checkRest.rows.length === 0) continue;
    await supabasePool.query(`
      INSERT INTO tables (
        id, restaurant_id, table_code, capacity, section, qr_token, table_status, is_deleted, createdat, updatedat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)
      ON CONFLICT (id) DO UPDATE SET table_code = EXCLUDED.table_code, qr_token = EXCLUDED.qr_token;
    `, [
      t.id,
      t.restaurant_id,
      t.table_number,
      t.capacity || 4,
      t.section || null,
      t.qr_code_token || ('qr_' + t.id),
      t.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      t.created_at || new Date(),
      t.updated_at || new Date()
    ]);
  }
  console.log(`Tables transferred: ${tblRes.rows.length}`);

  await renderPool.end();
  await supabasePool.end();
  console.log('All existing data safely migrated and preserved in Supabase PostgreSQL!');
}

syncData().catch(err => {
  console.error('Data sync failed:', err);
  process.exit(1);
});
