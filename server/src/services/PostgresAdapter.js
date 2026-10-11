/**
 * Dynease Database Adapter
 * Seamlessly routes queries between MongoDB and PostgreSQL.
 * Allows instant, reliable switching or dual-write.
 */

const { pool, query, queryOne } = require('../config/postgres');

class PostgresAdapter {
  constructor() {
    this.pool = pool;
  }

  // 1. Registries (Platform)
  async getRegistryBySubdomain(subdomain) {
    const res = await query(
      'SELECT * FROM dynease_restaurant_registries WHERE subdomain = $1 LIMIT 1',
      [subdomain]
    );
    return res.rows[0] ? this.formatRegistry(res.rows[0]) : null;
  }

  async getRegistryById(restaurantId) {
    const res = await query(
      'SELECT * FROM dynease_restaurant_registries WHERE restaurant_id = $1 LIMIT 1',
      [restaurantId]
    );
    return res.rows[0] ? this.formatRegistry(res.rows[0]) : null;
  }

  formatRegistry(row) {
    return {
      _id: row.id,
      id: row.id,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      slug: row.slug,
      subdomain: row.subdomain,
      databaseName: row.database_name,
      ownerEmail: row.owner_email,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone,
      googleReviewLink: row.google_review_link,
      status: row.status,
      selectedPlan: row.selected_plan,
      subscriptionStatus: row.subscription_status,
      subscriptionStartDate: row.subscription_start_date,
      subscriptionEndDate: row.subscription_end_date,
      activatedAt: row.activated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // 2. Restaurant Profiles
  async getProfile(restaurantId) {
    const res = await query(
      'SELECT * FROM dynease_restaurant_profiles WHERE restaurant_id = $1 LIMIT 1',
      [restaurantId]
    );
    return res.rows[0] ? this.formatProfile(res.rows[0]) : null;
  }

  formatProfile(row) {
    return {
      _id: row.id,
      id: row.id,
      restaurantId: row.restaurant_id,
      name: row.name,
      subtitle: row.subtitle,
      slug: row.slug,
      type: row.type,
      description: row.description,
      logo: row.logo,
      coverImage: row.cover_image,
      address: row.address,
      phone: row.phone,
      email: row.email,
      openingHours: row.opening_hours,
      cuisineType: row.cuisine_type || [],
      taxInfo: row.tax_info || { taxPercentage: 0 },
      currency: row.currency || 'INR',
      isActive: row.is_active,
      googleReviewLink: row.google_review_link,
      assignmentSettings: row.assignment_settings || { mode: 'HYBRID', defaultCapacity: 5 },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // 3. Menu Items & Categories
  async getCategories(restaurantId) {
    const res = await query(
      'SELECT * FROM dynease_categories WHERE restaurant_id = $1 AND is_active = true ORDER BY display_order ASC, name ASC',
      [restaurantId]
    );
    return res.rows.map(r => ({
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      name: r.name,
      displayOrder: r.display_order,
      isActive: r.is_active,
      image: r.image
    }));
  }

  async getMenuItems(restaurantId, filter = {}) {
    let sql = 'SELECT * FROM dynease_menu_items WHERE restaurant_id = $1';
    const params = [restaurantId];
    if (filter.isAvailable !== undefined) {
      params.push(filter.isAvailable);
      sql += ` AND is_available = $${params.length}`;
    }
    sql += ' ORDER BY category ASC, name ASC';
    const res = await query(sql, params);
    return res.rows.map(r => ({
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      categoryId: r.category_id,
      category: r.category,
      name: r.name,
      description: r.description,
      price: parseFloat(r.price),
      image: r.image,
      isAvailable: r.is_available,
      dietaryPreference: r.dietary_preference,
      preparationTime: r.preparation_time,
      variants: r.variants || []
    }));
  }

  // 4. Tables
  async getTables(restaurantId) {
    const res = await query(
      'SELECT * FROM dynease_tables WHERE restaurant_id = $1 ORDER BY table_number ASC',
      [restaurantId]
    );
    return res.rows.map(r => this.formatTable(r));
  }

  async getTableByToken(token) {
    const res = await query(
      'SELECT * FROM dynease_tables WHERE qr_code_token = $1 LIMIT 1',
      [token]
    );
    return res.rows[0] ? this.formatTable(res.rows[0]) : null;
  }

  formatTable(r) {
    return {
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      tableNumber: r.table_number,
      capacity: r.capacity,
      section: r.section,
      status: r.status,
      qrCodeToken: r.qr_code_token,
      qrCodeUrl: r.qr_code_url,
      primaryWaiterId: r.primary_waiter_id,
      assignmentMode: r.assignment_mode,
      assignedAt: r.assigned_at,
      assignedBy: r.assigned_by,
      assignmentStatus: r.assignment_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // 5. Orders
  async getOrders(restaurantId, filter = {}) {
    let sql = 'SELECT * FROM dynease_orders WHERE restaurant_id = $1';
    const params = [restaurantId];
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        params.push(filter.status);
        sql += ` AND status = ANY($${params.length})`;
      } else {
        params.push(filter.status);
        sql += ` AND status = $${params.length}`;
      }
    }
    sql += ' ORDER BY created_at DESC';
    const res = await query(sql, params);
    return res.rows.map(r => this.formatOrder(r));
  }

  formatOrder(r) {
    return {
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      tableId: r.table_id,
      tableNumber: r.table_number,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      items: r.items,
      totalAmount: parseFloat(r.total_amount),
      taxAmount: parseFloat(r.tax_amount || 0),
      discountAmount: parseFloat(r.discount_amount || 0),
      finalAmount: parseFloat(r.final_amount),
      status: r.status,
      orderNumber: r.order_number,
      isReadByWaiter: r.is_read_by_waiter,
      specialInstructions: r.special_instructions,
      paymentStatus: r.payment_status,
      paymentMethod: r.payment_method,
      assignedWaiterId: r.assigned_waiter_id,
      assignmentType: r.assignment_type,
      assignmentStatus: r.assignment_status,
      assignedAt: r.assigned_at,
      assignmentTimeoutAt: r.assignment_timeout_at,
      acceptedAt: r.accepted_at,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // 6. Users
  async findUser(restaurantId, emailOrPhone) {
    const res = await query(
      'SELECT * FROM dynease_users WHERE restaurant_id = $1 AND (email = $2 OR phone = $2) LIMIT 1',
      [restaurantId, emailOrPhone.toLowerCase()]
    );
    return res.rows[0] ? this.formatUser(res.rows[0]) : null;
  }

  formatUser(r) {
    return {
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      name: r.name,
      email: r.email,
      password: r.password,
      role: r.role,
      phone: r.phone,
      isActive: r.is_active,
      shiftStatus: r.shift_status,
      availabilityStatus: r.availability_status,
      acceptingOrders: r.accepting_orders,
      workloadCapacity: r.workload_capacity,
      lastAssignedAt: r.last_assigned_at,
      sections: r.sections || [],
      assignedTables: r.assigned_tables || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}

module.exports = new PostgresAdapter();
