/**
 * Dynease Database Adapter backed by Drizzle ORM and Supabase PostgreSQL
 */

const { db, schema, pool } = require('../db/client');
const { eq, and, sql, or } = require('drizzle-orm');
const {
  restaurants,
  users,
  tables,
  tables_assignment,
  menu_categories,
  menu_categories_items,
  order_details,
  order_items
} = schema;

class PostgresAdapter {
  constructor() {
    this.db = db;
    this.schema = schema;
    this.pool = pool;
  }

  // 1. Registries & Profiles (using restaurants table)
  async getRegistryBySubdomain(subdomain) {
    const [row] = await db.select().from(restaurants).where(
      and(
        eq(sql`LOWER(${restaurants.domain})`, subdomain.toLowerCase()),
        eq(restaurants.is_deleted, false)
      )
    ).limit(1);

    return row ? this.formatRestaurant(row) : null;
  }

  async getRegistryById(restaurantId) {
    const [row] = await db.select().from(restaurants).where(
      and(
        eq(restaurants.id, restaurantId),
        eq(restaurants.is_deleted, false)
      )
    ).limit(1);

    return row ? this.formatRestaurant(row) : null;
  }

  async getProfile(restaurantId) {
    return this.getRegistryById(restaurantId);
  }

  formatRestaurant(row) {
    return {
      _id: row.id,
      id: row.id,
      restaurantId: row.id,
      restaurantName: row.name,
      name: row.name,
      slug: row.domain,
      subdomain: row.domain,
      domain: row.domain,
      databaseName: `dynease_${row.domain}`,
      ownerPhone: row.phone_number,
      phone: row.phone_number,
      address: row.address || {},
      status: row.restaurant_status,
      selectedPlan: row.plan_id || 'STARTER',
      subscriptionStatus: row.restaurant_status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      isActive: row.restaurant_status === 'ACTIVE' && !row.is_deleted,
      tableAllocationMode: row.table_allocation_mode,
      assignmentSettings: { mode: row.table_allocation_mode, defaultCapacity: 5 },
      currency: 'INR',
      createdAt: row.createdat,
      updatedAt: row.updatedat
    };
  }

  // 2. Menu Items & Categories
  async getCategories(restaurantId) {
    const rows = await db.select().from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        eq(menu_categories.menu_category_status, 'ACTIVE'),
        eq(menu_categories.is_deleted, false)
      )
    ).orderBy(menu_categories.display_order, menu_categories.category);

    return rows.map(r => ({
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      name: r.category,
      displayOrder: r.display_order,
      isActive: r.menu_category_status === 'ACTIVE' && !r.is_deleted,
      description: r.description
    }));
  }

  async getMenuItems(restaurantId, filter = {}) {
    const conditions = [
      eq(menu_categories_items.restaurant_id, restaurantId),
      eq(menu_categories_items.is_deleted, false)
    ];

    if (filter.isAvailable !== undefined) {
      conditions.push(eq(menu_categories_items.menu_item_status, filter.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'));
    }

    const rows = await db.select().from(menu_categories_items).where(
      and(...conditions)
    ).orderBy(menu_categories_items.name);

    return rows.map(r => ({
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      categoryId: r.category_id,
      category: '',
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      isAvailable: r.menu_item_status === 'AVAILABLE',
      dietaryPreference: r.menu_item_type,
      preparationTime: r.preparation_time,
      itemSize: r.item_size
    }));
  }

  // 3. Tables
  async getTables(restaurantId) {
    const rows = await db.select().from(tables).where(
      and(
        eq(tables.restaurant_id, restaurantId),
        eq(tables.is_deleted, false)
      )
    ).orderBy(tables.table_code);

    return rows.map(r => this.formatTable(r));
  }

  async getTableByToken(token) {
    const [row] = await db.select().from(tables).where(
      and(
        eq(tables.qr_token, token),
        eq(tables.is_deleted, false)
      )
    ).limit(1);

    return row ? this.formatTable(row) : null;
  }

  formatTable(r) {
    return {
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      tableNumber: r.table_code,
      capacity: r.capacity,
      section: r.section,
      status: r.table_status,
      qrCodeToken: r.qr_token,
      createdAt: r.createdat,
      updatedAt: r.updatedat
    };
  }

  // 4. Orders
  async getOrders(restaurantId, filter = {}) {
    const conditions = [
      eq(order_details.restaurant_id, restaurantId)
    ];

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        conditions.push(sql`${order_details.app_status} = ANY(${filter.status})`);
      } else {
        conditions.push(eq(order_details.app_status, filter.status));
      }
    }

    const rows = await db.select().from(order_details).where(
      and(...conditions)
    ).orderBy(sql`${order_details.date} DESC`);

    return rows.map(r => this.formatOrder(r));
  }

  formatOrder(r) {
    return {
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      tableId: r.table_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      totalAmount: parseFloat(r.total_amount),
      taxAmount: parseFloat(r.tax_amount || 0),
      discountAmount: parseFloat(r.discount_amount || 0),
      finalAmount: parseFloat(r.final_amount),
      status: r.app_status,
      orderNumber: r.order_number,
      paymentStatus: r.payment_status,
      paymentMethod: r.payment_method,
      assignedWaiterId: r.assigned_waiter_id,
      createdAt: r.date,
      updatedAt: r.updatedat
    };
  }

  // 5. Users
  async findUser(restaurantId, emailOrPhone) {
    const queryTerm = emailOrPhone.toLowerCase().trim();
    const [row] = await db.select().from(users).where(
      and(
        eq(users.restaurant_id, restaurantId),
        eq(users.is_deleted, false),
        or(
          eq(sql`LOWER(${users.email})`, queryTerm),
          eq(users.phone_number, queryTerm)
        )
      )
    ).limit(1);

    return row ? this.formatUser(row) : null;
  }

  async findUserById(userId) {
    const [row] = await db.select().from(users).where(
      and(
        eq(users.id, userId),
        eq(users.is_deleted, false)
      )
    ).limit(1);

    return row ? this.formatUser(row) : null;
  }

  formatUser(r) {
    return {
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      name: r.name,
      email: r.email,
      password: r.password,
      role: r.user_type === 'ADMIN' ? 'RESTAURANT_OWNER' : 'RESTAURANT_STAFF',
      userType: r.user_type,
      phone: r.phone_number,
      isActive: r.user_status === 'ACTIVE' && !r.is_deleted,
      userStatus: r.user_status,
      sessionVersion: r.sessionVersion,
      createdAt: r.createdat,
      updatedAt: r.updatedat
    };
  }
}

module.exports = new PostgresAdapter();
