/**
 * Direct PostgreSQL Migration Script
 * Connects to MongoDB (all databases) and Render PostgreSQL.
 * Creates relational tables directly in PostgreSQL and migrates all data.
 */

require('../src/config/env');
const path = require('path');
const mongoose = require('mongoose');
const { Pool } = require('pg');

const MONGO_URI = process.env.MONGO_URI;
const DATABASE_URL = process.env.DATABASE_URL;

if (!MONGO_URI || !DATABASE_URL) {
  console.error('Missing MONGO_URI or DATABASE_URL in environment.');
  process.exit(1);
}

const pgPool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runSql(sql, params = []) {
  const client = await pgPool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function createTables() {
  console.log('--- Step 1: Creating PostgreSQL Tables ---');

  const ddl = `
    -- 1. Restaurant Registries (Platform)
    CREATE TABLE IF NOT EXISTS dynease_restaurant_registries (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) UNIQUE NOT NULL,
      restaurant_name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      subdomain VARCHAR(255) UNIQUE NOT NULL,
      database_name VARCHAR(255),
      owner_email VARCHAR(255),
      owner_name VARCHAR(255),
      owner_phone VARCHAR(50),
      google_review_link TEXT DEFAULT '',
      status VARCHAR(50) DEFAULT 'ACTIVE',
      selected_plan VARCHAR(50) DEFAULT 'FREE',
      subscription_status VARCHAR(50) DEFAULT 'ACTIVE',
      subscription_start_date TIMESTAMPTZ,
      subscription_end_date TIMESTAMPTZ,
      activated_at TIMESTAMPTZ,
      last_payment_at TIMESTAMPTZ,
      payment_status VARCHAR(50),
      renewal_history JSONB DEFAULT '[]'::jsonb,
      reminders_sent JSONB DEFAULT '{"sevenDay": false, "threeDay": false, "oneDay": false, "expired": false}'::jsonb,
      database_provisioned BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Restaurant Profiles
    CREATE TABLE IF NOT EXISTS dynease_restaurant_profiles (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      subtitle VARCHAR(255),
      slug VARCHAR(255) NOT NULL,
      type VARCHAR(100) DEFAULT 'Restaurant',
      description TEXT,
      logo JSONB,
      cover_image JSONB,
      address JSONB,
      phone VARCHAR(50),
      email VARCHAR(255),
      opening_hours JSONB,
      cuisine_type JSONB DEFAULT '[]'::jsonb,
      tax_info JSONB,
      currency VARCHAR(10) DEFAULT 'INR',
      is_active BOOLEAN DEFAULT true,
      google_review_link TEXT DEFAULT '',
      assignment_settings JSONB DEFAULT '{"mode": "HYBRID", "defaultCapacity": 5, "weightWorkload": 0.60, "weightRecentAssignment": 0.25, "weightSectionMismatch": 0.15, "allowOverflow": true, "acceptanceTimeoutMinutes": 3, "reassignmentPolicy": "AUTO_REASSIGN"}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 3. Dynease Users (Staff, Waiters, Owners)
    CREATE TABLE IF NOT EXISTS dynease_users (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'RESTAURANT_STAFF',
      phone VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      shift_status VARCHAR(50) DEFAULT 'ON_SHIFT',
      availability_status VARCHAR(50) DEFAULT 'AVAILABLE',
      accepting_orders BOOLEAN DEFAULT true,
      workload_capacity INT DEFAULT 5,
      last_assigned_at TIMESTAMPTZ,
      sections JSONB DEFAULT '[]'::jsonb,
      assigned_tables JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_dynease_restaurant_user_email UNIQUE (restaurant_id, email)
    );

    -- 4. Categories
    CREATE TABLE IF NOT EXISTS dynease_categories (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      display_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      image JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_dynease_restaurant_category_name UNIQUE (restaurant_id, name)
    );

    -- 5. Menu Items
    CREATE TABLE IF NOT EXISTS dynease_menu_items (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      category_id VARCHAR(64),
      category VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      image JSONB,
      is_available BOOLEAN DEFAULT true,
      dietary_preference VARCHAR(50) DEFAULT 'VEG',
      preparation_time INT DEFAULT 15,
      variants JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 6. Tables
    CREATE TABLE IF NOT EXISTS dynease_tables (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      table_number VARCHAR(50) NOT NULL,
      capacity INT DEFAULT 4,
      section VARCHAR(100),
      status VARCHAR(50) DEFAULT 'ACTIVE',
      qr_code_token VARCHAR(255) UNIQUE,
      qr_code_url TEXT,
      primary_waiter_id VARCHAR(64),
      assignment_mode VARCHAR(50) DEFAULT 'HYBRID',
      assigned_at TIMESTAMPTZ,
      assigned_by VARCHAR(255),
      assignment_status VARCHAR(50) DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT uq_dynease_restaurant_table_number UNIQUE (restaurant_id, table_number)
    );

    -- 7. Orders
    CREATE TABLE IF NOT EXISTS dynease_orders (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      table_id VARCHAR(64) NOT NULL,
      table_number VARCHAR(50) NOT NULL,
      customer_name VARCHAR(255) DEFAULT 'Guest',
      customer_phone VARCHAR(50),
      items JSONB NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      tax_amount NUMERIC(10, 2) DEFAULT 0,
      discount_amount NUMERIC(10, 2) DEFAULT 0,
      final_amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING',
      order_number VARCHAR(100) NOT NULL,
      is_read_by_waiter BOOLEAN DEFAULT false,
      special_instructions TEXT,
      payment_status VARCHAR(50) DEFAULT 'PENDING',
      payment_method VARCHAR(50) DEFAULT 'CASH',
      assigned_waiter_id VARCHAR(64),
      assignment_type VARCHAR(50) DEFAULT 'PRIMARY',
      assignment_status VARCHAR(50) DEFAULT 'PENDING_ACCEPTANCE',
      assigned_at TIMESTAMPTZ,
      assignment_timeout_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 8. Service Requests
    CREATE TABLE IF NOT EXISTS dynease_service_requests (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      table_id VARCHAR(64) NOT NULL,
      table_number VARCHAR(50) NOT NULL,
      type VARCHAR(50) DEFAULT 'CALL_WAITER',
      note TEXT DEFAULT '',
      status VARCHAR(50) DEFAULT 'OPEN',
      assigned_waiter_id VARCHAR(64),
      acknowledged_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolved_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 9. Assignment Events (Audit Log)
    CREATE TABLE IF NOT EXISTS dynease_assignment_events (
      id VARCHAR(64) PRIMARY KEY,
      restaurant_id VARCHAR(64) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(64) NOT NULL,
      table_id VARCHAR(64),
      table_number VARCHAR(50),
      previous_waiter_id VARCHAR(64),
      new_waiter_id VARCHAR(64),
      assignment_mode VARCHAR(50) DEFAULT 'HYBRID',
      action VARCHAR(50) NOT NULL,
      actor_id VARCHAR(64),
      actor_role VARCHAR(50),
      score NUMERIC(10, 4),
      score_inputs JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 10. Indexes for High Performance
    CREATE INDEX IF NOT EXISTS idx_dynease_orders_restaurant_status ON dynease_orders(restaurant_id, status);
    CREATE INDEX IF NOT EXISTS idx_dynease_orders_assigned_waiter ON dynease_orders(restaurant_id, assigned_waiter_id, status);
    CREATE INDEX IF NOT EXISTS idx_dynease_users_restaurant_role ON dynease_users(restaurant_id, role, is_active, shift_status);
    CREATE INDEX IF NOT EXISTS idx_dynease_tables_restaurant ON dynease_tables(restaurant_id, status);
    CREATE INDEX IF NOT EXISTS idx_dynease_menu_items_restaurant ON dynease_menu_items(restaurant_id, is_available);
    CREATE INDEX IF NOT EXISTS idx_dynease_service_requests_status ON dynease_service_requests(restaurant_id, status);
  `;

  await runSql(ddl);
  console.log('PostgreSQL tables created successfully.');
}

async function migrateData() {
  console.log('--- Step 2: Connecting to MongoDB ---');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const adminDb = mongoose.connection.db.admin();
  const dbsList = await adminDb.listDatabases();
  console.log(`Found ${dbsList.databases.length} MongoDB databases.`);

  // 1. Migrate Central Platform Registry
  console.log('Migrating central restaurant_details / RestaurantRegistry...');
  const centralDb = mongoose.connection.db;
  const registryCol = centralDb.collection('restaurant_details');
  const registries = await registryCol.find({}).toArray();
  console.log(`Found ${registries.length} restaurant registries.`);

  for (const reg of registries) {
    const id = reg._id.toString();
    const restId = reg.restaurantId || id;
    const query = `
      INSERT INTO dynease_restaurant_registries (
        id, restaurant_id, restaurant_name, slug, subdomain, database_name,
        owner_email, owner_name, owner_phone, google_review_link, status,
        selected_plan, subscription_status, subscription_start_date, subscription_end_date,
        activated_at, last_payment_at, payment_status, renewal_history, reminders_sent,
        database_provisioned, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (restaurant_id) DO UPDATE SET
        restaurant_name = EXCLUDED.restaurant_name,
        slug = EXCLUDED.slug,
        subdomain = EXCLUDED.subdomain,
        status = EXCLUDED.status,
        updated_at = NOW();
    `;
    await runSql(query, [
      id,
      restId,
      reg.restaurantName || 'Unnamed Restaurant',
      reg.slug || reg.subdomain || restId,
      reg.subdomain || restId,
      reg.databaseName || `dynease_${reg.subdomain || restId}`,
      reg.ownerEmail || 'admin@dynease.in',
      reg.ownerName || null,
      reg.ownerPhone || null,
      reg.googleReviewLink || '',
      reg.status || 'ACTIVE',
      reg.selectedPlan || 'FREE',
      reg.subscriptionStatus || 'ACTIVE',
      reg.subscriptionStartDate || null,
      reg.subscriptionEndDate || null,
      reg.activatedAt || null,
      reg.lastPaymentAt || null,
      reg.paymentStatus || null,
      JSON.stringify(reg.renewalHistory || []),
      JSON.stringify(reg.remindersSent || { sevenDay: false, threeDay: false, oneDay: false, expired: false }),
      true,
      reg.createdAt || new Date(),
      reg.updatedAt || new Date()
    ]);
  }
  console.log(`Synced ${registries.length} restaurant registries.`);

  // 2. Identify all tenant databases (either named dynease_tenant_* or matching registry.databaseName or single central DB)
  const tenantDbNames = new Set();
  // Include database names from registries
  registries.forEach(r => {
    if (r.databaseName) tenantDbNames.add(r.databaseName);
  });
  // Also check all databases on the mongo cluster
  dbsList.databases.forEach(d => {
    if (d.name.startsWith('dynease_tenant_') || d.name === 'dynease') {
      tenantDbNames.add(d.name);
    }
  });

  console.log(`Processing collections across ${tenantDbNames.size} databases:`, Array.from(tenantDbNames));

  for (const dbName of tenantDbNames) {
    console.log(`\n--- Inspecting MongoDB database: ${dbName} ---`);
    const tDb = mongoose.connection.client.db(dbName);
    const collections = await tDb.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    // A. Restaurant Profiles
    if (colNames.includes('restaurantprofiles') || colNames.includes('restaurant_profiles') || colNames.includes('restaurants')) {
      const colName = colNames.find(c => ['restaurantprofiles', 'restaurant_profiles', 'restaurants'].includes(c));
      const profiles = await tDb.collection(colName).find({}).toArray();
      for (const p of profiles) {
        const id = p._id.toString();
        const rId = p.restaurantId || id;
        const q = `
          INSERT INTO dynease_restaurant_profiles (
            id, restaurant_id, name, subtitle, slug, type, description,
            logo, cover_image, address, phone, email, opening_hours, cuisine_type,
            tax_info, currency, is_active, google_review_link, assignment_settings,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (restaurant_id) DO UPDATE SET
            name = EXCLUDED.name,
            subtitle = EXCLUDED.subtitle,
            assignment_settings = EXCLUDED.assignment_settings,
            updated_at = NOW();
        `;
        await runSql(q, [
          id,
          rId,
          p.name || 'Restaurant',
          p.subtitle || null,
          p.slug || rId,
          p.type || 'Restaurant',
          p.description || null,
          JSON.stringify(p.logo || null),
          JSON.stringify(p.coverImage || null),
          JSON.stringify(p.address || null),
          p.phone || null,
          p.email || null,
          JSON.stringify(p.openingHours || null),
          JSON.stringify(p.cuisineType || []),
          JSON.stringify(p.taxInfo || { taxPercentage: 0 }),
          p.currency || 'INR',
          p.isActive !== false,
          p.googleReviewLink || '',
          JSON.stringify(p.assignmentSettings || { mode: 'HYBRID', defaultCapacity: 5 }),
          p.createdAt || new Date(),
          p.updatedAt || new Date()
        ]);
        console.log(`  -> Synced Restaurant Profile: ${p.name} (${rId})`);
      }
    }

    // Determine current restaurantId for this tenant database
    let targetRestaurantId = null;
    const matchReg = registries.find(r => r.databaseName === dbName || r.restaurantId === dbName.replace('dynease_tenant_', ''));
    if (matchReg) targetRestaurantId = matchReg.restaurantId;

    // B. Categories
    if (colNames.includes('categories')) {
      const categories = await tDb.collection('categories').find({}).toArray();
      for (const cat of categories) {
        const rId = cat.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_categories (id, restaurant_id, name, display_order, is_active, image, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (restaurant_id, name) DO UPDATE SET
            display_order = EXCLUDED.display_order,
            is_active = EXCLUDED.is_active,
            image = EXCLUDED.image,
            updated_at = NOW();
        `;
        await runSql(q, [
          cat._id.toString(),
          rId,
          cat.name,
          cat.displayOrder || 0,
          cat.isActive !== false,
          JSON.stringify(cat.image || null),
          cat.createdAt || new Date(),
          cat.updatedAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${categories.length} Categories from ${dbName}`);
    }

    // C. Menu Items
    if (colNames.includes('menuitems') || colNames.includes('menu_items')) {
      const colName = colNames.find(c => ['menuitems', 'menu_items'].includes(c));
      const items = await tDb.collection(colName).find({}).toArray();
      for (const item of items) {
        const rId = item.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_menu_items (
            id, restaurant_id, category_id, category, name, description,
            price, image, is_available, dietary_preference, preparation_time,
            variants, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            category = EXCLUDED.category,
            is_available = EXCLUDED.is_available,
            updated_at = NOW();
        `;
        await runSql(q, [
          item._id.toString(),
          rId,
          item.categoryId ? item.categoryId.toString() : null,
          item.category || 'General',
          item.name,
          item.description || null,
          parseFloat(item.price || 0),
          JSON.stringify(item.image || null),
          item.isAvailable !== false,
          item.dietaryPreference || 'VEG',
          item.preparationTime || 15,
          JSON.stringify(item.variants || []),
          item.createdAt || new Date(),
          item.updatedAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${items.length} Menu Items from ${dbName}`);
    }

    // D. Users / Staff
    if (colNames.includes('users')) {
      const users = await tDb.collection('users').find({}).toArray();
      for (const u of users) {
        const rId = u.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_users (
            id, restaurant_id, name, email, password, role, phone, is_active,
            shift_status, availability_status, accepting_orders, workload_capacity,
            last_assigned_at, sections, assigned_tables, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (restaurant_id, email) DO UPDATE SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            shift_status = EXCLUDED.shift_status,
            availability_status = EXCLUDED.availability_status,
            accepting_orders = EXCLUDED.accepting_orders,
            workload_capacity = EXCLUDED.workload_capacity,
            sections = EXCLUDED.sections,
            updated_at = NOW();
        `;
        await runSql(q, [
          u._id.toString(),
          rId,
          u.name || 'User',
          u.email ? u.email.toLowerCase() : `user_${u._id}@dynease.local`,
          u.password || '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
          u.role || 'RESTAURANT_STAFF',
          u.phone || null,
          u.isActive !== false,
          u.shiftStatus || 'ON_SHIFT',
          u.availabilityStatus || 'AVAILABLE',
          u.acceptingOrders !== false,
          u.workloadCapacity || 5,
          u.lastAssignedAt || null,
          JSON.stringify(u.sections || []),
          JSON.stringify((u.assignedTables || []).map(t => t.toString())),
          u.createdAt || new Date(),
          u.updatedAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${users.length} Users from ${dbName}`);
    }

    // E. Tables
    if (colNames.includes('tables')) {
      const tables = await tDb.collection('tables').find({}).toArray();
      for (const t of tables) {
        const rId = t.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_tables (
            id, restaurant_id, table_number, capacity, section, status,
            qr_code_token, qr_code_url, primary_waiter_id, assignment_mode,
            assigned_at, assigned_by, assignment_status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (restaurant_id, table_number) DO UPDATE SET
            capacity = EXCLUDED.capacity,
            section = EXCLUDED.section,
            status = EXCLUDED.status,
            primary_waiter_id = EXCLUDED.primary_waiter_id,
            assignment_mode = EXCLUDED.assignment_mode,
            updated_at = NOW();
        `;
        await runSql(q, [
          t._id.toString(),
          rId,
          String(t.tableNumber || t.number || '1'),
          t.capacity || 4,
          t.section || null,
          t.status || 'ACTIVE',
          t.qrCodeToken || `qr_${t._id.toString()}`,
          t.qrCodeUrl || null,
          t.primaryWaiterId ? t.primaryWaiterId.toString() : null,
          t.assignmentMode || 'HYBRID',
          t.assignedAt || null,
          t.assignedBy || null,
          t.assignmentStatus || 'ACTIVE',
          t.createdAt || new Date(),
          t.updatedAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${tables.length} Tables from ${dbName}`);
    }

    // F. Orders
    if (colNames.includes('orders')) {
      const orders = await tDb.collection('orders').find({}).toArray();
      for (const o of orders) {
        const rId = o.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_orders (
            id, restaurant_id, table_id, table_number, customer_name, customer_phone,
            items, total_amount, tax_amount, discount_amount, final_amount, status,
            order_number, is_read_by_waiter, special_instructions, payment_status,
            payment_method, assigned_waiter_id, assignment_type, assignment_status,
            assigned_at, assignment_timeout_at, accepted_at, rejection_reason,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            is_read_by_waiter = EXCLUDED.is_read_by_waiter,
            assigned_waiter_id = EXCLUDED.assigned_waiter_id,
            assignment_status = EXCLUDED.assignment_status,
            updated_at = NOW();
        `;
        await runSql(q, [
          o._id.toString(),
          rId,
          o.tableId ? o.tableId.toString() : 'tbl_placeholder',
          String(o.tableNumber || o.table || '1'),
          o.customerName || 'Guest',
          o.customerPhone || null,
          JSON.stringify(o.items || []),
          parseFloat(o.totalAmount || 0),
          parseFloat(o.taxAmount || 0),
          parseFloat(o.discountAmount || 0),
          parseFloat(o.finalAmount || o.totalAmount || 0),
          o.status || 'PENDING',
          o.orderNumber || o._id.toString().substring(0, 8),
          o.isReadByWaiter || false,
          o.specialInstructions || null,
          o.paymentStatus || 'PENDING',
          o.paymentMethod || 'CASH',
          o.assignedWaiterId ? o.assignedWaiterId.toString() : null,
          o.assignmentType || 'PRIMARY',
          o.assignmentStatus || 'ACCEPTED',
          o.assignedAt || null,
          o.assignmentTimeoutAt || null,
          o.acceptedAt || null,
          o.rejectionReason || null,
          o.createdAt || new Date(),
          o.updatedAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${orders.length} Orders from ${dbName}`);
    }

    // G. Service Requests
    if (colNames.includes('servicerequests') || colNames.includes('service_requests')) {
      const colName = colNames.find(c => ['servicerequests', 'service_requests'].includes(c));
      const sReqs = await tDb.collection(colName).find({}).toArray();
      for (const s of sReqs) {
        const rId = s.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_service_requests (
            id, restaurant_id, table_id, table_number, type, note, status,
            assigned_waiter_id, acknowledged_at, resolved_at, resolved_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            resolved_at = EXCLUDED.resolved_at,
            updated_at = NOW();
        `;
        await runSql(q, [
          s._id.toString(),
          rId,
          s.tableId ? s.tableId.toString() : 'tbl_placeholder',
          String(s.tableNumber || '1'),
          s.type || 'CALL_WAITER',
          s.note || '',
          s.status || 'OPEN',
          s.assignedWaiterId ? s.assignedWaiterId.toString() : null,
          s.acknowledgedAt || null,
          s.resolvedAt || null,
          s.resolvedBy || null,
          s.createdAt || new Date(),
          s.updatedAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${sReqs.length} Service Requests from ${dbName}`);
    }

    // H. Assignment Events
    if (colNames.includes('assignmentevents') || colNames.includes('assignment_events')) {
      const colName = colNames.find(c => ['assignmentevents', 'assignment_events'].includes(c));
      const evts = await tDb.collection(colName).find({}).toArray();
      for (const ev of evts) {
        const rId = ev.restaurantId || targetRestaurantId || 'default';
        const q = `
          INSERT INTO dynease_assignment_events (
            id, restaurant_id, target_type, target_id, table_id, table_number,
            previous_waiter_id, new_waiter_id, assignment_mode, action,
            actor_id, actor_role, score, score_inputs, reason, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING;
        `;
        await runSql(q, [
          ev._id.toString(),
          rId,
          ev.targetType || 'ORDER',
          ev.targetId ? ev.targetId.toString() : 'unknown',
          ev.tableId ? ev.tableId.toString() : null,
          ev.tableNumber || null,
          ev.previousWaiterId ? ev.previousWaiterId.toString() : null,
          ev.newWaiterId ? ev.newWaiterId.toString() : null,
          ev.assignmentMode || 'HYBRID',
          ev.action || 'ASSIGNED',
          ev.actorId ? ev.actorId.toString() : null,
          ev.actorRole || 'SYSTEM',
          ev.score !== undefined ? parseFloat(ev.score) : null,
          JSON.stringify(ev.scoreInputs || null),
          ev.reason || null,
          ev.createdAt || new Date()
        ]);
      }
      console.log(`  -> Synced ${evts.length} Assignment Events from ${dbName}`);
    }
  }

  console.log('\n========================================');
  console.log('✅ ALL TABLES AND DATA MIGRATED TO POSTGRESQL SUCCESSFULLY!');
  console.log('========================================');
}

async function verifyMigration() {
  console.log('\n--- Step 3: Verifying PostgreSQL Counts ---');
  const tablesToCheck = [
    'dynease_restaurant_registries',
    'dynease_restaurant_profiles',
    'dynease_categories',
    'dynease_menu_items',
    'dynease_users',
    'dynease_tables',
    'dynease_orders',
    'dynease_service_requests',
    'dynease_assignment_events'
  ];

  for (const t of tablesToCheck) {
    const res = await runSql(`SELECT COUNT(*) as count FROM ${t}`);
    console.log(`  Table [${t}]: ${res.rows[0].count} records`);
  }
}

async function main() {
  try {
    await createTables();
    await migrateData();
    await verifyMigration();
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    await pgPool.end();
    process.exit(0);
  }
}

main();
