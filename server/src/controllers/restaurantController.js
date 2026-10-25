const crypto = require('crypto');
const { db, schema } = require('../db/client');
const { eq, and, sql, desc, or, isNull, gte, lte, inArray } = require('drizzle-orm');
const {
  restaurants,
  users,
  tables,
  tables_assignment,
  menu_categories,
  menu_categories_items,
  order_details,
  customer_orders,
  order_items,
  leads,
  service_requests,
  assignment_events,
  audit_log,
  plan_requests,
  plans,
  table_session
} = schema;
const { uploadToCloudinary } = require('../utils/cloudinary');
const RealtimeService = require('../services/RealtimeService');
const SubscriptionService = require('../services/SubscriptionService');
const WaiterAssignmentService = require('../services/waiterAssignmentService');
const OrderService = require('../services/OrderService');
const CustomerSessionService = require('../services/CustomerSessionService');
const { getPlan, getPublicPlans } = require('../config/plans');


// ──────────────────────────────────────────
//  CATEGORY CRUD
// ──────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const categoryRows = await db.select().from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    ).orderBy(menu_categories.display_order, menu_categories.category);

    const categories = categoryRows.map(c => {
      const explicitType = (c.type || '').toLowerCase().trim();
      const catLower = (c.category || '').toLowerCase();
      const isNonVeg = explicitType === 'non-veg' || (
        explicitType !== 'veg' && (
          catLower.includes('non-veg') ||
          catLower.includes('non veg') ||
          catLower.includes('nonveg') ||
          catLower.includes('chicken') ||
          catLower.includes('mutton') ||
          catLower.includes('fish') ||
          catLower.includes('prawn') ||
          catLower.includes('seafood') ||
          catLower.includes('egg')
        )
      );

      return {
        _id: c.id,
        id: c.id,
        restaurantId: c.restaurant_id,
        name: c.category,
        description: c.description || '',
        image: c.image || null,
        displayOrder: c.display_order ?? 0,
        isActive: c.menu_category_status === 'ACTIVE',
        type: isNonVeg ? 'non-veg' : 'veg'
      };
    });

    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, description, displayOrder, type } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const [existing] = await db.select().from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        eq(sql`LOWER(${menu_categories.category})`, name.trim().toLowerCase()),
        isNull(menu_categories.deletedat)
      )
    ).limit(1);

    if (existing) {
      return res.status(409).json({ success: false, message: 'A category with this name already exists.' });
    }

    let image = null;
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/categories/${restaurantId}`);
        image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error('Cloudinary Upload Error:', uploadError);
      }
    }

    const normType = (type?.trim()?.toLowerCase() === 'non-veg') ? 'non-veg' : 'veg';
    const [category] = await db.insert(menu_categories).values({
      restaurant_id: restaurantId,
      category: name.trim(),
      description: description?.trim() || '',
      type: normType,
      image,
      display_order: displayOrder !== undefined && displayOrder !== '' ? parseInt(displayOrder, 10) : 0,
      menu_category_status: 'ACTIVE'
    }).returning();

    RealtimeService.menuUpdated(restaurantId);

    res.status(201).json({
      success: true,
      data: {
        category: {
          _id: category.id,
          id: category.id,
          name: category.category,
          description: category.description,
          displayOrder: category.display_order,
          type: category.type === 'non-veg' ? 'non-veg' : 'veg',
          isActive: category.menu_category_status === 'ACTIVE',
          image
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error creating category:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { name, description, displayOrder, isActive, type } = req.body;

    const updateFields = {
      updatedat: new Date()
    };

    if (name) updateFields.category = name.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (type !== undefined) updateFields.type = (type.trim().toLowerCase() === 'non-veg') ? 'non-veg' : 'veg';
    if (displayOrder !== undefined && displayOrder !== '') updateFields.display_order = parseInt(displayOrder, 10);
    if (isActive !== undefined) {
      updateFields.menu_category_status = (isActive === true || isActive === 'true') ? 'ACTIVE' : 'INACTIVE';
    }

    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/categories/${restaurantId}`);
        updateFields.image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error('Cloudinary Upload Error:', uploadError);
      }
    }

    const [category] = await db.update(menu_categories).set(updateFields).where(
      and(
        eq(menu_categories.id, id),
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    ).returning();

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    RealtimeService.menuUpdated(restaurantId);

    res.status(200).json({
      success: true,
      data: {
        category: {
          _id: category.id,
          id: category.id,
          name: category.category,
          description: category.description,
          image: category.image || null,
          displayOrder: category.display_order,
          type: category.type || 'all',
          isActive: category.menu_category_status === 'ACTIVE'
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error updating category:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const [category] = await db.select().from(menu_categories).where(
      and(
        eq(menu_categories.id, id),
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    ).limit(1);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    const [itemCount] = await db.select({ count: sql`count(*)` }).from(menu_categories_items).where(
      and(
        eq(menu_categories_items.category_id, id),
        eq(menu_categories_items.restaurant_id, restaurantId),
        isNull(menu_categories_items.deletedat)
      )
    );

    if (parseInt(itemCount.count, 10) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${itemCount.count} menu item(s) use this category. Reassign them first.`
      });
    }

    await db.update(menu_categories).set({
      deletedat: new Date()
    }).where(
      and(
        eq(menu_categories.id, id),
        eq(menu_categories.restaurant_id, restaurantId)
      )
    );

    RealtimeService.menuUpdated(restaurantId);

    res.status(200).json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    console.error('[RestaurantController] Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  MENU ITEM CRUD
// ──────────────────────────────────────────

exports.createMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { 
      category, 
      categoryId, 
      name, 
      description, 
      price, 
      isAvailable, 
      dietaryPreference, 
      type,
      itemSize,
      size,
      rating,
      displayOrder 
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Item name is required.' });
    }

    // Parse and normalize portions/quantities
    let parsedQuantities = [];
    if (req.body.quantities) {
      try {
        parsedQuantities = typeof req.body.quantities === 'string'
          ? JSON.parse(req.body.quantities)
          : req.body.quantities;
      } catch (e) {
        parsedQuantities = [];
      }
    }
    if (!Array.isArray(parsedQuantities)) parsedQuantities = [];
    parsedQuantities = parsedQuantities
      .filter(q => q && q.size && String(q.size).trim() && q.price !== undefined && q.price !== '' && !isNaN(parseFloat(q.price)))
      .map(q => ({ size: String(q.size).trim(), price: parseFloat(parseFloat(q.price).toFixed(2)) }));

    // Determine effective price
    let effectivePrice = null;
    if (parsedQuantities.length > 0) {
      effectivePrice = parsedQuantities[0].price;
    } else if (price !== undefined && price !== null && price !== '' && !isNaN(parseFloat(price))) {
      effectivePrice = parseFloat(price);
      parsedQuantities = [{ size: (itemSize || size || 'Full').toUpperCase(), price: effectivePrice }];
    }

    if (effectivePrice === null || isNaN(effectivePrice) || effectivePrice < 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one portion size and valid price.' });
    }

    // Enforce subscription plan menu item limit
    await SubscriptionService.checkResourceLimit(null, req.tenantRegistry || { restaurantId }, 'menuItems', 1);

    // Resolve category and enforce tenant isolation
    let catId = categoryId;
    let catName = category || 'General';

    if (catId) {
      const [validCat] = await db.select().from(menu_categories).where(
        and(
          eq(menu_categories.id, catId),
          eq(menu_categories.restaurant_id, restaurantId),
          isNull(menu_categories.deletedat)
        )
      ).limit(1);

      if (!validCat) {
        return res.status(400).json({ success: false, message: 'Invalid category or category does not belong to your restaurant.' });
      }
      catName = validCat.category;
    } else if (category?.trim()) {
      const [foundCat] = await db.select().from(menu_categories).where(
        and(
          eq(menu_categories.restaurant_id, restaurantId),
          eq(sql`LOWER(${menu_categories.category})`, category.trim().toLowerCase()),
          isNull(menu_categories.deletedat)
        )
      ).limit(1);

      if (foundCat) {
        catId = foundCat.id;
        catName = foundCat.category;
      } else {
        const [newCat] = await db.insert(menu_categories).values({
          restaurant_id: restaurantId,
          category: category.trim(),
          menu_category_status: 'ACTIVE'
        }).returning();
        catId = newCat.id;
        catName = newCat.category;
      }
    } else {
      const [firstCat] = await db.select().from(menu_categories).where(
        and(
          eq(menu_categories.restaurant_id, restaurantId),
          isNull(menu_categories.deletedat)
        )
      ).limit(1);

      if (firstCat) {
        catId = firstCat.id;
        catName = firstCat.category;
      } else {
        const [newCat] = await db.insert(menu_categories).values({
          restaurant_id: restaurantId,
          category: 'General',
          menu_category_status: 'ACTIVE'
        }).returning();
        catId = newCat.id;
        catName = newCat.category;
      }
    }

    let image = null;
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/menu/${restaurantId}`);
        image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error('Cloudinary Upload Error:', uploadError);
      }
    }

    const itemType = (dietaryPreference || type || '').toLowerCase().includes('non') ? 'NON_VEG' : 'VEG';
    const validSizes = ['SMALL', 'MEDIUM', 'LARGE', 'JUMBO', 'FULL', 'HALF'];
    const chosenSize = (parsedQuantities[0]?.size || itemSize || size || 'FULL').toUpperCase();
    const finalSize = validSizes.includes(chosenSize) ? chosenSize : 'FULL';

    let ratingVal = null;
    if (rating !== undefined && rating !== null && !isNaN(rating)) {
      const r = parseFloat(rating);
      if (r >= 0 && r <= 5) ratingVal = r.toFixed(2);
    }

    const [menuItem] = await db.insert(menu_categories_items).values({
      restaurant_id: restaurantId,
      category_id: catId,
      name: name.trim(),
      description: description?.trim() || '',
      image,
      price: effectivePrice.toFixed(2),
      quantities: parsedQuantities,
      menu_item_status: isAvailable !== false ? 'AVAILABLE' : 'UNAVAILABLE',
      menu_item_type: itemType,
      item_size: finalSize,
      rating: ratingVal,
      display_order: displayOrder !== undefined ? parseInt(displayOrder, 10) || 0 : 0
    }).returning();

    RealtimeService.menuUpdated(restaurantId);

    res.status(201).json({
      success: true,
      data: {
        menuItem: {
          _id: menuItem.id,
          id: menuItem.id,
          restaurantId: menuItem.restaurant_id,
          category: catName,
          categoryId: menuItem.category_id,
          name: menuItem.name,
          description: menuItem.description,
          price: parseFloat(menuItem.price),
          isAvailable: menuItem.menu_item_status === 'AVAILABLE',
          dietaryPreference: menuItem.menu_item_type === 'VEG' ? 'VEG' : 'NON_VEG',
          itemSize: menuItem.item_size,
          displayOrder: menuItem.display_order,
          rating: menuItem.rating ? parseFloat(menuItem.rating) : null,
          preparationTime: 15,
          image,
          quantities: menuItem.quantities || parsedQuantities || []
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error creating menu item:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { 
      category, 
      categoryId, 
      name, 
      description, 
      price, 
      isAvailable, 
      dietaryPreference, 
      type,
      itemSize,
      size,
      rating,
      displayOrder 
    } = req.body;

    const [existingItem] = await db.select().from(menu_categories_items).where(
      and(
        eq(menu_categories_items.id, id),
        eq(menu_categories_items.restaurant_id, restaurantId),
        isNull(menu_categories_items.deletedat)
      )
    ).limit(1);

    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Menu item not found in your restaurant.' });
    }

    const updateFields = {
      updatedat: new Date()
    };

    if (name?.trim()) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();

    // Parse and handle quantities
    if (req.body.quantities !== undefined) {
      let parsedQuantities = [];
      try {
        parsedQuantities = typeof req.body.quantities === 'string'
          ? JSON.parse(req.body.quantities)
          : req.body.quantities;
      } catch (e) {
        parsedQuantities = [];
      }
      if (!Array.isArray(parsedQuantities)) parsedQuantities = [];
      parsedQuantities = parsedQuantities
        .filter(q => q && q.size && String(q.size).trim() && q.price !== undefined && q.price !== '' && !isNaN(parseFloat(q.price)))
        .map(q => ({ size: String(q.size).trim(), price: parseFloat(parseFloat(q.price).toFixed(2)) }));

      updateFields.quantities = parsedQuantities;
      if (parsedQuantities.length > 0 && (price === undefined || price === null || price === '')) {
        updateFields.price = parsedQuantities[0].price.toFixed(2);
      }
    }
    
    if (price !== undefined && price !== null && price !== '') {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: 'Price must be a valid non-negative number.' });
      }
      updateFields.price = parsedPrice.toFixed(2);
    }

    if (isAvailable !== undefined) {
      updateFields.menu_item_status = isAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
    }

    if (dietaryPreference || type) {
      updateFields.menu_item_type = (dietaryPreference || type).toLowerCase().includes('non') ? 'NON_VEG' : 'VEG';
    }

    if (categoryId) {
      const [validCat] = await db.select().from(menu_categories).where(
        and(
          eq(menu_categories.id, categoryId),
          eq(menu_categories.restaurant_id, restaurantId),
          isNull(menu_categories.deletedat)
        )
      ).limit(1);

      if (!validCat) {
        return res.status(400).json({ success: false, message: 'Category not found or does not belong to your restaurant.' });
      }
      updateFields.category_id = categoryId;
    }

    if (itemSize || size) {
      const validSizes = ['SMALL', 'MEDIUM', 'LARGE', 'JUMBO', 'FULL', 'HALF'];
      const chosenSize = (itemSize || size).toUpperCase();
      if (validSizes.includes(chosenSize)) updateFields.item_size = chosenSize;
    }

    if (rating !== undefined) {
      const r = parseFloat(rating);
      if (!isNaN(r) && r >= 0 && r <= 5) updateFields.rating = r.toFixed(2);
    }

    if (displayOrder !== undefined) {
      updateFields.display_order = parseInt(displayOrder, 10) || 0;
    }

    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file.buffer, `dynease/menu/${restaurantId}`);
        updateFields.image = {
          public_id: uploadResult.public_id,
          secure_url: uploadResult.secure_url
        };
      } catch (uploadError) {
        console.error('Cloudinary Upload Error:', uploadError);
      }
    }

    const [menuItem] = await db.update(menu_categories_items).set(updateFields).where(
      and(
        eq(menu_categories_items.id, id),
        eq(menu_categories_items.restaurant_id, restaurantId)
      )
    ).returning();

    const [cat] = await db.select().from(menu_categories).where(eq(menu_categories.id, menuItem.category_id)).limit(1);

    RealtimeService.menuUpdated(restaurantId);

    res.status(200).json({
      success: true,
      data: {
        menuItem: {
          _id: menuItem.id,
          id: menuItem.id,
          restaurantId: menuItem.restaurant_id,
          category: cat?.category || 'General',
          categoryId: menuItem.category_id,
          name: menuItem.name,
          description: menuItem.description,
          image: menuItem.image || null,
          price: parseFloat(menuItem.price),
          isAvailable: menuItem.menu_item_status === 'AVAILABLE',
          dietaryPreference: menuItem.menu_item_type === 'VEG' ? 'VEG' : 'NON_VEG',
          itemSize: menuItem.item_size,
          displayOrder: menuItem.display_order,
          rating: menuItem.rating ? parseFloat(menuItem.rating) : null,
          preparationTime: 15,
          quantities: (Array.isArray(menuItem.quantities) && menuItem.quantities.length > 0)
            ? menuItem.quantities
            : (menuItem.item_size ? [{ size: menuItem.item_size, price: parseFloat(menuItem.price) }] : [])
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error updating menu item:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { category, type } = req.query;

    const conditions = [
      eq(menu_categories_items.restaurant_id, restaurantId),
      isNull(menu_categories_items.deletedat)
    ];

    if (type) {
      const isNonVeg = type.toLowerCase().includes('non');
      conditions.push(eq(menu_categories_items.menu_item_type, isNonVeg ? 'NON_VEG' : 'VEG'));
    }

    const rows = await db.select().from(menu_categories_items).where(
      and(...conditions)
    ).orderBy(menu_categories_items.display_order, menu_categories_items.name);

    const categoryDocs = await db.select().from(menu_categories).where(
      and(
        eq(menu_categories.restaurant_id, restaurantId),
        isNull(menu_categories.deletedat)
      )
    );
    const catMap = new Map();
    categoryDocs.forEach(c => catMap.set(c.id, c.category));

    let menuItems = rows.map(r => ({
      _id: r.id,
      id: r.id,
      restaurantId: r.restaurant_id,
      categoryId: r.category_id,
      category: catMap.get(r.category_id) || 'General',
      name: r.name,
      description: r.description,
      image: r.image || null,
      price: parseFloat(r.price),
      isAvailable: r.menu_item_status === 'AVAILABLE',
      dietaryPreference: r.menu_item_type === 'VEG' ? 'VEG' : 'NON_VEG',
      preparationTime: 15,
      quantities: (Array.isArray(r.quantities) && r.quantities.length > 0)
        ? r.quantities
        : (r.item_size ? [{ size: r.item_size, price: parseFloat(r.price) }] : [{ size: 'Full', price: parseFloat(r.price) }])
    }));

    if (category) {
      menuItems = menuItems.filter(i => i.category.toLowerCase() === category.toLowerCase());
    }

    res.status(200).json({ success: true, data: { menuItems } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching menu:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const [item] = await db.update(menu_categories_items).set({
      deletedat: new Date()
    }).where(
      and(
        eq(menu_categories_items.id, id),
        eq(menu_categories_items.restaurant_id, restaurantId)
      )
    ).returning();

    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    RealtimeService.menuUpdated(restaurantId);

    res.status(200).json({ success: true, message: 'Menu item deleted.' });
  } catch (error) {
    console.error('[RestaurantController] Error deleting menu item:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.toggleMenuItemStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { isAvailable } = req.body;

    const [item] = await db.update(menu_categories_items).set({
      menu_item_status: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      updatedat: new Date()
    }).where(
      and(
        eq(menu_categories_items.id, id),
        eq(menu_categories_items.restaurant_id, restaurantId)
      )
    ).returning();

    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    RealtimeService.menuUpdated(restaurantId);

    res.status(200).json({ success: true, data: { menuItem: item } });
  } catch (error) {
    console.error('[RestaurantController] Error toggling status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  ORDER MANAGEMENT
// ──────────────────────────────────────────

exports.getOrders = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { status, type, date, startDate, endDate } = req.query;

    const conditions = [
      eq(order_details.restaurant_id, restaurantId)
    ];

    if (status) {
      conditions.push(eq(order_details.order_status, status));
    } else if (type === 'live') {
      conditions.push(sql`${order_details.order_status} IN ('ORDERED', 'PREPARING', 'READY', 'SERVED')`);
    } else if (type === 'past') {
      conditions.push(sql`${order_details.order_status} IN ('COMPLETED', 'CANCELLED', 'PAID')`);
    }

    if (date) {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      conditions.push(and(gte(order_details.date, start), lte(order_details.date, end)));
    } else if (startDate && endDate) {
      conditions.push(and(gte(order_details.date, new Date(startDate)), lte(order_details.date, new Date(endDate))));
    }

    // If caller is STAFF (waiter), check if they have specific table assignments
    if (req.user.userType === 'STAFF') {
      const myAssignments = await db.select().from(tables_assignment).where(
        and(
          eq(tables_assignment.restaurant_id, restaurantId),
          eq(tables_assignment.staff_id, req.user.id),
          eq(tables_assignment.assignment_status, 'ASSIGNED')
        )
      );
      if (myAssignments.length > 0) {
        const assignedTableIds = myAssignments.map(a => a.table_id);
        conditions.push(or(
          inArray(order_details.table_id, assignedTableIds),
          isNull(order_details.table_id)
        ));
      }
    }

    const orderRows = await db.select().from(order_details)
      .where(and(...conditions))
      .orderBy(desc(order_details.date))
      .limit(100);

    const orders = [];
    for (const ord of orderRows) {
      const items = await db.select().from(order_items).where(
        or(
          eq(order_items.visit_id, ord.id),
          eq(order_items.order_id, ord.id)
        )
      );

      const [tbl] = ord.table_id ? await db.select().from(tables).where(eq(tables.id, ord.table_id)).limit(1) : [null];
      const [lead] = ord.lead_id ? await db.select().from(leads).where(eq(leads.id, ord.lead_id)).limit(1) : [null];

      let assignedWaiter = null;
      if (ord.table_id) {
        const [asgn] = await db.select().from(tables_assignment).where(
          and(
            eq(tables_assignment.table_id, ord.table_id),
            eq(tables_assignment.assignment_status, 'ASSIGNED')
          )
        ).limit(1);

        if (asgn) {
          const [w] = await db.select().from(users).where(eq(users.id, asgn.staff_id)).limit(1);
          if (w) {
            assignedWaiter = {
              _id: w.id,
              id: w.id,
              name: w.name,
              email: w.email,
              phone: w.phone_number
            };
          }
        }
      }

      const totalCalculated = items.reduce((sum, oi) => sum + parseFloat(oi.total || 0), 0);

      orders.push({
        _id: ord.id,
        id: ord.id,
        orderNumber: `ORD-${ord.id.slice(0, 8).toUpperCase()}`,
        restaurantId: ord.restaurant_id,
        tableId: ord.table_id ? {
          _id: ord.table_id,
          id: ord.table_id,
          tableNumber: tbl?.table_code || 'Table',
          tableName: `Table ${tbl?.table_code || ''}`,
          section: 'Main',
          isOccupied: true
        } : null,
        tableNumber: tbl?.table_code || 'Takeaway',
        customerName: lead?.name || ord.customer_name || 'Guest',
        customerPhone: lead?.number || ord.customer_phone || null,
        specialInstructions: ord.special_instructions || '',
        items: items.map(oi => ({
          _id: oi.id,
          id: oi.id,
          itemName: oi.item_name,
          quantity: oi.quantity,
          requestedQuantity: oi.requested_quantity || oi.quantity,
          acceptedQuantity: oi.accepted_quantity !== null && oi.accepted_quantity !== undefined ? oi.accepted_quantity : oi.quantity,
          unitPrice: parseFloat(oi.unit_price),
          subtotal: parseFloat(oi.total),
          total: parseFloat(oi.total),
          status: oi.item_status || 'PENDING',
          size: oi.customizations || null,
          menuItemId: oi.menu_item_id
        })),
        subtotal: totalCalculated,
        taxPercent: 0,
        taxAmount: 0,
        discount: 0,
        total: totalCalculated,
        totalAmount: totalCalculated,
        status: (ord.app_status === 'ACCEPTED' || ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(ord.order_status)) 
          ? (['PREPARING', 'READY', 'SERVED'].includes(ord.order_status) ? ord.order_status : 'ACCEPTED') 
          : (ord.order_status === 'ORDERED' && ord.app_status === 'PENDING' ? 'SUBMITTED' : ord.order_status),
        appStatus: (ord.app_status === 'ACCEPTED' || ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(ord.order_status)) ? 'ACCEPTED' : ord.app_status,
        assignmentStatus: (ord.app_status === 'ACCEPTED' || ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(ord.order_status)) 
          ? 'ACCEPTED' 
          : (['ORDERED', 'PENDING'].includes(ord.order_status) ? 'PENDING_ACCEPTANCE' : 'ASSIGNED'),
        paymentStatus: ['COMPLETED', 'PAID'].includes(ord.order_status) ? 'PAID' : 'PENDING',
        assignedWaiterId: assignedWaiter,
        createdAt: ord.date || ord.createdat,
        updatedAt: ord.updatedat
      });
    }

    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const [order] = await db.select().from(order_details).where(
      and(
        eq(order_details.id, id),
        eq(order_details.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Canonical statuses supported by the order_status enum
    const ORDER_STATUSES = ['NO_ORDER', 'ORDERED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'PAID', 'CANCELLED'];
    // Legacy UI aliases mapped onto canonical statuses
    const STATUS_ALIASES = { NEW: 'ORDERED', PENDING: 'ORDERED', READ: 'PREPARING' };
    // Forward-only transitions; waiters may skip straight to COMPLETED/CANCELLED
    const validTransitions = {
      'NO_ORDER': ['ORDERED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'],
      'ORDERED': ['PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'],
      'PREPARING': ['READY', 'SERVED', 'COMPLETED', 'CANCELLED'],
      'READY': ['SERVED', 'COMPLETED', 'CANCELLED'],
      'SERVED': ['COMPLETED', 'PAID', 'CANCELLED'],
      'COMPLETED': ['PAID', 'COMPLETED'],
      'CANCELLED': [],
      'PAID': []
    };

    const currentStatus = order.order_status;
    const nextStatus = STATUS_ALIASES[status] || status;

    if (!ORDER_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: `Invalid order status: ${status}.` });
    }

    // Idempotent: if already in requested status (and not COMPLETED), return success
    if (currentStatus === nextStatus && nextStatus !== 'COMPLETED') {
      return res.status(200).json({ success: true, data: { order } });
    }

    const allowed = validTransitions[currentStatus] || [];
    if (req.user.userType === 'STAFF' && !allowed.includes(nextStatus) && currentStatus !== nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Cannot change order status from ${currentStatus} to ${status}.`
      });
    }

    const updateFields = {
      order_status: nextStatus,
      updatedat: new Date()
    };

    if (nextStatus === 'COMPLETED') {
      updateFields.app_status = 'COMPLETED';
      updateFields.payment_status = 'PAID';
    } else if (nextStatus === 'CANCELLED') {
      updateFields.app_status = 'CANCELLED';
    }

    const [updatedOrder] = await db.update(order_details).set(updateFields)
      .where(eq(order_details.id, id))
      .returning();

    let tableNumber = 'Takeaway';
    if (order.table_id) {
      const [tbl] = await db.select().from(tables).where(eq(tables.id, order.table_id)).limit(1);
      if (tbl) tableNumber = tbl.table_code;
    }

    // ── When marked COMPLETED, atomically free the table and close sessions ──
    if (nextStatus === 'COMPLETED') {
      // 1. Mark all child customer_orders as COMPLETED
      await db.update(customer_orders).set({
        order_status: 'COMPLETED',
        updatedat: new Date()
      }).where(
        and(
          eq(customer_orders.visit_id, order.id),
          sql`${customer_orders.order_status} NOT IN ('COMPLETED', 'CANCELLED')`
        )
      );

      // 2. Close active table_session for this table to free it for new customers
      if (order.table_id) {
        await db.update(table_session).set({
          session_status: 'COMPLETED',
          session_end_time: new Date(),
          closed_by: req.user.id || req.user._id,
          updatedat: new Date()
        }).where(
          and(
            eq(table_session.table_id, order.table_id),
            eq(table_session.session_status, 'ACTIVE')
          )
        );
      }
      if (order.session_id) {
        await db.update(table_session).set({
          session_status: 'COMPLETED',
          session_end_time: new Date(),
          closed_by: req.user.id || req.user._id,
          updatedat: new Date()
        }).where(eq(table_session.id, order.session_id));
      }

      // 3. Increment lead visits
      if (order.lead_id) {
        await db.update(leads).set({
          visits: sql`${leads.visits} + 1`,
          updatedat: new Date()
        }).where(eq(leads.id, order.lead_id));
      }

      // 4. Notify realtime rooms that visit is closed and table is available
      if (order.table_id) {
        RealtimeService.visitClosed({
          restaurantId,
          tableId: order.table_id,
          visitId: order.id,
          tableNumber
        });
      }
    } else if (nextStatus === 'CANCELLED') {
      // Cancel any child customer_orders
      await db.update(customer_orders).set({
        order_status: 'CANCELLED',
        updatedat: new Date()
      }).where(eq(customer_orders.visit_id, order.id));

      // Release table if order was cancelled
      if (order.table_id) {
        await db.update(table_session).set({
          session_status: 'CANCELLED',
          session_end_time: new Date(),
          closed_by: req.user.id || req.user._id,
          updatedat: new Date()
        }).where(
          and(
            eq(table_session.table_id, order.table_id),
            eq(table_session.session_status, 'ACTIVE')
          )
        );
      }
      if (order.session_id) {
        await db.update(table_session).set({
          session_status: 'CANCELLED',
          session_end_time: new Date(),
          closed_by: req.user.id || req.user._id,
          updatedat: new Date()
        }).where(eq(table_session.id, order.session_id));
      }

      if (order.table_id) {
        RealtimeService.allocationCancelled({
          restaurantId,
          tableId: order.table_id,
          visitId: order.id,
          reason: 'Order cancelled by staff'
        });
      }
    }

    RealtimeService.orderUpdated({
      restaurantId,
      order: {
        _id: updatedOrder.id,
        id: updatedOrder.id,
        status: updatedOrder.order_status,
        appStatus: updatedOrder.app_status,
        restaurantId,
        tableId: updatedOrder.table_id,
        tableNumber,
        updatedAt: updatedOrder.updatedat
      },
      orderId: updatedOrder.id,
      tableId: updatedOrder.table_id
    });

    res.status(200).json({ success: true, data: { order: updatedOrder } });
  } catch (error) {
    console.error('[RestaurantController] Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.acceptOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const waiterId = req.user.id || req.user._id;

    let visitId = id;
    const [custOrder] = await db.select().from(customer_orders).where(
      and(
        eq(customer_orders.id, id),
        eq(customer_orders.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (custOrder) {
      visitId = custOrder.visit_id;
    }

    // Always accept all child customer_orders under this visit/order
    await db.update(customer_orders)
      .set({ order_status: 'ACCEPTED', updatedat: new Date() })
      .where(
        and(
          eq(customer_orders.visit_id, visitId),
          eq(customer_orders.restaurant_id, restaurantId)
        )
      );

    const [visit] = await db.select().from(order_details).where(
      and(
        eq(order_details.id, visitId),
        eq(order_details.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const [updatedVisit] = await db.update(order_details)
      .set({
        app_status: 'ACCEPTED',
        order_status: 'ORDERED',
        assigned_waiter_id: waiterId || visit.assigned_waiter_id,
        updatedat: new Date()
      })
      .where(eq(order_details.id, visitId))
      .returning();

    await db.update(order_items)
      .set({ item_status: 'ACCEPTED', updatedat: new Date() })
      .where(
        and(
          eq(order_items.visit_id, visitId),
          eq(order_items.item_status, 'PENDING')
        )
      );

    let tableNumber = 'Takeaway';
    if (updatedVisit.table_id) {
      const [tbl] = await db.select().from(tables).where(eq(tables.id, updatedVisit.table_id)).limit(1);
      if (tbl) tableNumber = tbl.table_code;
    }

    const updatedOrder = {
      ...updatedVisit,
      id: updatedVisit.id,
      _id: updatedVisit.id,
      visitId: updatedVisit.id,
      tableNumber,
      status: 'ACCEPTED',
      appStatus: 'ACCEPTED',
      assignmentStatus: 'ACCEPTED'
    };

    RealtimeService.orderUpdated({
      restaurantId,
      order: updatedOrder,
      orderId: visitId,
      tableId: updatedVisit.table_id
    });

    res.status(200).json({ success: true, message: 'Order accepted successfully', data: { order: updatedOrder } });
  } catch (error) {
    console.error('[RestaurantController] Error accepting order:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to accept order' });
  }
};

exports.rejectOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { reason } = req.body;

    let visitId = id;
    const [custOrder] = await db.select().from(customer_orders).where(
      and(
        eq(customer_orders.id, id),
        eq(customer_orders.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (custOrder) {
      visitId = custOrder.visit_id;
      await db.update(customer_orders)
        .set({ order_status: 'CANCELLED', updatedat: new Date() })
        .where(eq(customer_orders.id, custOrder.id));
    }

    const [visit] = await db.select().from(order_details).where(
      and(
        eq(order_details.id, visitId),
        eq(order_details.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!visit) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const [updatedVisit] = await db.update(order_details)
      .set({
        order_status: 'CANCELLED',
        app_status: 'CANCELLED',
        updatedat: new Date()
      })
      .where(eq(order_details.id, visitId))
      .returning();

    await db.update(order_items)
      .set({
        item_status: 'UNAVAILABLE',
        rejection_reason: reason || 'Waiter rejected',
        updatedat: new Date()
      })
      .where(eq(order_items.visit_id, visitId));

    if (updatedVisit.table_id) {
      await db.update(table_session).set({
        session_status: 'CANCELLED',
        session_end_time: new Date(),
        closed_by: req.user.id || req.user._id,
        updatedat: new Date()
      }).where(
        and(
          eq(table_session.table_id, updatedVisit.table_id),
          eq(table_session.session_status, 'ACTIVE')
        )
      );

      RealtimeService.allocationCancelled({
        restaurantId,
        tableId: updatedVisit.table_id,
        visitId,
        reason: reason || 'Waiter rejected'
      });
    }

    const updatedOrder = {
      ...updatedVisit,
      id: updatedVisit.id,
      _id: updatedVisit.id,
      status: 'CANCELLED',
      appStatus: 'CANCELLED',
      assignmentStatus: 'REJECTED'
    };

    RealtimeService.orderUpdated({
      restaurantId,
      order: updatedOrder,
      orderId: visitId,
      tableId: updatedVisit.table_id
    });

    res.status(200).json({ success: true, message: 'Order rejected successfully', data: { order: updatedOrder } });
  } catch (error) {
    console.error('[RestaurantController] Error rejecting order:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject order' });
  }
};

/**
 * DELETE /api/restaurant/orders/items/:id
 * Waiter deletes an item from an active order
 */
exports.deleteOrderItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    const [item] = await db.select().from(order_items).where(
      and(
        eq(order_items.id, id),
        eq(order_items.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Order item not found' });
    }

    const orderId = item.order_id;
    const visitId = item.visit_id;

    await db.delete(order_items).where(eq(order_items.id, id));

    if (orderId) {
      const remainingOrderItems = await db.select().from(order_items).where(
        eq(order_items.order_id, orderId)
      );
      const newOrderSubtotal = remainingOrderItems.reduce((sum, oi) => sum + parseFloat(oi.total || 0), 0).toFixed(2);
      await db.update(customer_orders).set({
        subtotal: newOrderSubtotal,
        updatedat: new Date()
      }).where(eq(customer_orders.id, orderId));
    }

    let updatedVisit = null;
    if (visitId) {
      const remainingVisitItems = await db.select().from(order_items).where(
        eq(order_items.visit_id, visitId)
      );
      const newVisitTotal = remainingVisitItems.reduce((sum, oi) => sum + parseFloat(oi.total || 0), 0).toFixed(2);
      [updatedVisit] = await db.update(order_details).set({
        total_amount: newVisitTotal,
        final_amount: newVisitTotal,
        updatedat: new Date()
      }).where(eq(order_details.id, visitId)).returning();
    }

    RealtimeService.orderUpdated({
      restaurantId,
      order: updatedVisit,
      orderId: orderId || visitId,
      tableId: updatedVisit?.table_id
    });

    res.status(200).json({
      success: true,
      message: 'Item deleted from order successfully',
      data: { itemId: id, orderId, visitId }
    });
  } catch (error) {
    console.error('[RestaurantController] Error deleting order item:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to delete order item' });
  }
};

/**
 * POST /api/restaurant/orders/:id/items
 * Waiter adds items to an active order
 */
exports.addOrderItems = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { items, specialInstructions } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    let visitId = id;
    const [cust] = await db.select().from(customer_orders).where(
      and(eq(customer_orders.id, id), eq(customer_orders.restaurant_id, restaurantId))
    ).limit(1);
    if (cust) {
      visitId = cust.visit_id;
    }

    const result = await OrderService.submitOrderInVisit({
      visitId,
      restaurantId,
      items: items.map(i => ({
        menu_item_id: i.menuItemId || i.menu_item_id || i.id,
        quantity: parseInt(i.quantity, 10) || 1,
        customizations: i.size || i.customizations || ''
      })),
      special_instructions: specialInstructions || ''
    });

    // When staff adds items, ensure order remains accepted and not reverted to PENDING
    if (result.order) {
      await db.update(customer_orders)
        .set({ order_status: 'ACCEPTED', updatedat: new Date() })
        .where(eq(customer_orders.id, result.order.id));
      result.order.order_status = 'ACCEPTED';
    }
    await db.update(order_details)
      .set({ app_status: 'ACCEPTED', updatedat: new Date() })
      .where(eq(order_details.id, visitId));

    const updatedOrderPayload = {
      ...result.order,
      visitId,
      status: 'ACCEPTED',
      appStatus: 'ACCEPTED',
      assignmentStatus: 'ACCEPTED'
    };

    RealtimeService.orderItemsAdded({
      restaurantId,
      order: updatedOrderPayload,
      orderId: result.order?.id,
      tableId: result.visit?.table_id,
      waiterId: req.user.id,
      newItems: result.items,
      addedCount: result.items.length
    });

    RealtimeService.orderUpdated({
      restaurantId,
      order: updatedOrderPayload,
      orderId: result.order?.id,
      tableId: result.visit?.table_id
    });

    res.status(200).json({
      success: true,
      message: 'Items added to order successfully',
      data: result
    });
  } catch (error) {
    console.error('[RestaurantController] Error adding items to order:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to add items to order' });
  }
};

exports.reassignOrder = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { waiterId } = req.body;

    const [order] = await db.select().from(order_details).where(
      and(
        eq(order_details.id, id),
        eq(order_details.restaurant_id, restaurantId)
      )
    ).limit(1);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let newWaiter = null;
    if (waiterId) {
      const [w] = await db.select().from(users).where(
        and(
          eq(users.id, waiterId),
          eq(users.restaurant_id, restaurantId),
          eq(users.is_deleted, false)
        )
      ).limit(1);
      if (!w) return res.status(400).json({ success: false, message: 'Target waiter not found in this restaurant' });
      newWaiter = w;
    }

    await db.insert(assignment_events).values({
      restaurant_id: restaurantId,
      assignment_id: order.id,
      staff_id: waiterId || null,
      event_type: waiterId ? 'MANUAL_REASSIGN' : 'UNASSIGNED',
      details: {
        orderId: order.id,
        waiterName: newWaiter?.name || null
      }
    });

    RealtimeService.orderUpdated({
      restaurantId,
      order,
      orderId: order.id,
      tableId: order.table_id
    });
    if (waiterId) RealtimeService.orderAssigned({ waiterId, order });

    res.status(200).json({ success: true, message: 'Order reassigned successfully', data: { order } });
  } catch (error) {
    console.error('[RestaurantController] Error reassigning order:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  ASSIGNMENT & WORKLOAD
// ──────────────────────────────────────────

exports.getAssignmentSettings = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const settings = await WaiterAssignmentService.getSettings(null, restaurantId);
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateAssignmentSettings = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { mode } = req.body;

    if (mode && (mode === 'MANUAL' || mode === 'DYNAMIC')) {
      await db.update(restaurants).set({
        table_allocation_mode: mode,
        updatedat: new Date()
      }).where(eq(restaurants.id, restaurantId));
    }

    const settings = await WaiterAssignmentService.getSettings(null, restaurantId);
    res.status(200).json({ success: true, message: 'Assignment settings updated', data: { settings } });
  } catch (error) {
    console.error('[RestaurantController] Error updating settings:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getAssignmentHistory = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const events = await db.select().from(assignment_events).where(
      eq(assignment_events.restaurant_id, restaurantId)
    ).orderBy(desc(assignment_events.createdat)).limit(100);

    res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching history:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getWaitersWorkload = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const settings = await WaiterAssignmentService.getSettings(null, restaurantId);

    const waiters = await db.select().from(users).where(
      and(
        eq(users.restaurant_id, restaurantId),
        eq(users.user_type, 'STAFF'),
        eq(users.is_deleted, false)
      )
    );

    const result = [];
    for (const w of waiters) {
      const { activeOrdersCount, activeRequestsCount, totalWorkload } = await WaiterAssignmentService.getWaiterWorkload(
        null,
        restaurantId,
        w.id
      );

      result.push({
        _id: w.id,
        id: w.id,
        name: w.name,
        email: w.email,
        phone: w.phone_number,
        shiftStatus: 'ON_SHIFT',
        availabilityStatus: 'AVAILABLE',
        acceptingOrders: true,
        workloadCapacity: settings.defaultCapacity || 5,
        sections: [],
        assignedTables: [],
        activeOrdersCount,
        activeRequestsCount,
        totalWorkload
      });
    }

    res.status(200).json({ success: true, data: { waiters: result } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching workload:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateMyAvailability = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const [user] = await db.select().from(users).where(
      and(eq(users.id, userId), eq(users.is_deleted, false))
    ).limit(1);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Availability updated',
      data: {
        user: {
          _id: user.id,
          name: user.name,
          shiftStatus: req.body.shiftStatus || 'ON_SHIFT',
          availabilityStatus: req.body.availabilityStatus || 'AVAILABLE',
          acceptingOrders: req.body.acceptingOrders !== false
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error updating availability:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  SERVICE REQUESTS
// ──────────────────────────────────────────

exports.getServiceRequests = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const requests = await db.select().from(service_requests).where(
      eq(service_requests.restaurant_id, restaurantId)
    ).orderBy(desc(service_requests.createdat)).limit(50);

    const formatted = [];
    for (const reqItem of requests) {
      const [table] = reqItem.table_id ? await db.select().from(tables).where(eq(tables.id, reqItem.table_id)).limit(1) : [null];

      formatted.push({
        _id: reqItem.id,
        id: reqItem.id,
        restaurantId: reqItem.restaurant_id,
        tableId: reqItem.table_id ? {
          _id: reqItem.table_id,
          id: reqItem.table_id,
          tableNumber: table?.table_code || 'Table',
          tableName: table?.table_code || 'Table',
          section: 'Main'
        } : null,
        type: reqItem.request_type,
        status: reqItem.request_status,
        note: reqItem.details?.note || '',
        createdAt: reqItem.createdat,
        updatedAt: reqItem.updatedat
      });
    }

    res.status(200).json({ success: true, data: { serviceRequests: formatted } });
  } catch (error) {
    console.error('[RestaurantController] Error fetching service requests:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.resolveServiceRequest = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { status } = req.body;

    const [updated] = await db.update(service_requests).set({
      request_status: status || 'RESOLVED',
      updatedat: new Date()
    }).where(
      and(
        eq(service_requests.id, id),
        eq(service_requests.restaurant_id, restaurantId)
      )
    ).returning();

    if (!updated) return res.status(404).json({ success: false, message: 'Request not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('service_request_updated', updated);
      io.to(`waiter:${restaurantId}`).emit('service_request_updated', updated);
    }

    res.status(200).json({ success: true, message: `Service request marked as ${updated.request_status}`, data: { serviceRequest: updated } });
  } catch (error) {
    console.error('[RestaurantController] Error resolving service request:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  PROFILE CRUD
// ──────────────────────────────────────────

exports.getProfile = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const [restaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, restaurantId), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        profile: {
          _id: restaurant.id,
          id: restaurant.id,
          restaurantId: restaurant.id,
          name: restaurant.restaurant_name || restaurant.name,
          subtitle: '',
          phone: restaurant.phone_number,
          address: restaurant.address,
          isActive: restaurant.restaurant_status === 'ACTIVE',
          latitude: restaurant.latitude ? parseFloat(restaurant.latitude) : null,
          longitude: restaurant.longitude ? parseFloat(restaurant.longitude) : null,
          geofenceRadiusMeters: restaurant.geofence_radius_meters || 50,
          googleReviewLink: null,
          taxInfo: { taxPercentage: 0 }
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, phone, address, latitude, longitude, geofenceRadiusMeters } = req.body;

    const updateFields = {
      updatedat: new Date()
    };
    if (name) {
      updateFields.restaurant_name = name.trim();
      updateFields.name = name.trim();
    }
    if (phone) updateFields.phone_number = phone.trim();
    if (address !== undefined) updateFields.address = address;
    if (latitude !== undefined) updateFields.latitude = latitude !== null ? String(latitude) : null;
    if (longitude !== undefined) updateFields.longitude = longitude !== null ? String(longitude) : null;
    if (geofenceRadiusMeters !== undefined) updateFields.geofence_radius_meters = parseInt(geofenceRadiusMeters, 10) || 50;

    const [restaurant] = await db.update(restaurants).set(updateFields).where(
      and(eq(restaurants.id, restaurantId), eq(restaurants.is_deleted, false))
    ).returning();

    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        profile: {
          _id: restaurant.id,
          id: restaurant.id,
          restaurantId: restaurant.id,
          name: restaurant.restaurant_name || restaurant.name,
          subtitle: '',
          phone: restaurant.phone_number,
          address: restaurant.address,
          latitude: restaurant.latitude ? parseFloat(restaurant.latitude) : null,
          longitude: restaurant.longitude ? parseFloat(restaurant.longitude) : null,
          geofenceRadiusMeters: restaurant.geofence_radius_meters || 50,
          isActive: restaurant.restaurant_status === 'ACTIVE'
        }
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  STATS
// ──────────────────────────────────────────

exports.getStats = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todaysOrders = await db.select().from(order_details).where(
      and(
        eq(order_details.restaurant_id, restaurantId),
        gte(order_details.date, startOfDay),
        lte(order_details.date, endOfDay)
      )
    );

    const todaysOrdersCount = todaysOrders.length;
    let revenue = 0;
    for (const ord of todaysOrders) {
      const items = await db.select().from(order_items).where(
        or(
          eq(order_items.visit_id, ord.id),
          eq(order_items.order_id, ord.id)
        )
      );
      const orderTotal = items.reduce((sum, it) => sum + parseFloat(it.total || 0), 0);
      revenue += orderTotal;
    }

    const [activeTablesRow] = await db.select({ count: sql`count(*)` }).from(tables).where(
      and(
        eq(tables.restaurant_id, restaurantId),
        eq(tables.table_status, 'ACTIVE'),
        eq(tables.is_deleted, false)
      )
    );

    res.status(200).json({
      success: true,
      data: {
        todaysOrders: todaysOrdersCount,
        revenue: parseFloat(revenue.toFixed(2)),
        activeTables: parseInt(activeTablesRow?.count || 0, 10)
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ──────────────────────────────────────────
//  SUBSCRIPTION
// ──────────────────────────────────────────

exports.getSubscription = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const [restaurant] = await db.select().from(restaurants).where(
      and(eq(restaurants.id, restaurantId), eq(restaurants.is_deleted, false))
    ).limit(1);

    if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

    let currentPlan = null;
    if (restaurant.plan_id) {
      const [p] = await db.select().from(plans).where(eq(plans.id, restaurant.plan_id)).limit(1);
      if (p) currentPlan = p;
    }

    const canonicalPlan = currentPlan
      ? {
          planId: currentPlan.name.toUpperCase(),
          name: currentPlan.name,
          limits: currentPlan.configuration?.limits || { maxTables: 10, maxMenuItems: 50, maxStaff: 3 },
          features: currentPlan.configuration?.features || [],
          displayFeatures: currentPlan.configuration?.displayFeatures || []
        }
      : (getPlan(restaurant.plan_id) || getPlan('STARTER'));

    const usageAndLimits = await SubscriptionService.getUsageAndLimits(null, {
      restaurantId: restaurant.id,
      selectedPlan: canonicalPlan.planId
    });

    // Check for pending plan change requests
    const [pendingRequest] = await db.select().from(plan_requests).where(
      and(
        eq(plan_requests.restaurant_id, restaurantId),
        eq(plan_requests.status, 'PENDING')
      )
    ).orderBy(desc(plan_requests.createdat)).limit(1);

    let pendingReqData = null;
    if (pendingRequest) {
      const [reqPlan] = await db.select().from(plans).where(eq(plans.id, pendingRequest.plan_id)).limit(1);
      pendingReqData = {
        _id: pendingRequest.id,
        id: pendingRequest.id,
        plan: reqPlan?.name || 'PLAN',
        billingCycle: pendingRequest.billing_cycle,
        status: pendingRequest.status,
        createdAt: pendingRequest.createdat
      };
    }

    // Fetch active plans available in system
    const availablePlansList = await db.select().from(plans).where(eq(plans.plan_status, 'ACTIVE')).orderBy(plans.createdat);

    res.status(200).json({
      success: true,
      data: {
        plan: canonicalPlan.planId,
        planName: canonicalPlan.name,
        billingCycle: 'monthly',
        status: restaurant.restaurant_status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        startDate: restaurant.createdat,
        endDate: null,
        remainingDays: 365,
        limits: canonicalPlan.limits,
        features: canonicalPlan.features,
        displayFeatures: canonicalPlan.displayFeatures,
        usage: usageAndLimits.usage,
        capacityRemaining: usageAndLimits.capacityRemaining,
        renewalRequest: pendingReqData,
        availablePlans: availablePlansList.map(p => ({
          _id: p.id,
          id: p.id,
          name: p.name,
          planId: p.configuration?.planId || p.name.toUpperCase(),
          description: p.configuration?.tagline || '',
          price: p.configuration?.monthlyDisplayPrice ?? null,
          billingPeriod: 'monthly',
          configuration: p.configuration
        }))
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error fetching subscription:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.renewSubscription = async (req, res) => {
  try {
    const { plan, planId, billingCycle = 'monthly' } = req.body;
    const restaurantId = req.user.restaurantId;

    let targetPlan = null;
    if (planId) {
      const [p] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
      if (p) targetPlan = p;
    }
    if (!targetPlan && plan) {
      const [p] = await db.select().from(plans).where(
        eq(sql`LOWER(${plans.name})`, String(plan).trim().toLowerCase())
      ).limit(1);
      if (p) targetPlan = p;
    }

    if (!targetPlan) {
      const fallback = getPlan(plan);
      if (fallback) {
        const [existingP] = await db.select().from(plans).where(
          eq(sql`LOWER(${plans.name})`, fallback.name.toLowerCase())
        ).limit(1);
        if (existingP) {
          targetPlan = existingP;
        } else {
          const [inserted] = await db.insert(plans).values({
            name: fallback.name,
            plan_status: 'ACTIVE',
            is_deleted: false,
            configuration: {
              planId: fallback.planId,
              name: fallback.name,
              tagline: fallback.tagline || '',
              limits: fallback.limits,
              features: fallback.features,
              displayFeatures: fallback.displayFeatures || [],
              monthlyDisplayPrice: fallback.monthlyDisplayPrice,
              yearlyDisplayPrice: fallback.yearlyDisplayPrice,
              monthlyPricePaise: fallback.monthlyPricePaise,
              yearlyPricePaise: fallback.yearlyPricePaise
            }
          }).returning();
          targetPlan = inserted;
        }
      }
    }

    if (!targetPlan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected. Choose from Starter, Growth, Business, or Pro.'
      });
    }

    // Check if there is already a PENDING request
    const [existingPending] = await db.select().from(plan_requests).where(
      and(
        eq(plan_requests.restaurant_id, restaurantId),
        eq(plan_requests.status, 'PENDING')
      )
    ).limit(1);

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending plan change request. Please wait for system admin review.'
      });
    }

    // Insert into plan_requests - do NOT mutate restaurants.plan_id directly
    const [newRequest] = await db.insert(plan_requests).values({
      restaurant_id: restaurantId,
      plan_id: targetPlan.id,
      billing_cycle: billingCycle,
      status: 'PENDING',
      requested_by: req.user.id
    }).returning();

    await db.insert(audit_log).values({
      restaurant_id: restaurantId,
      user_id: req.user.id,
      action: 'PLAN_CHANGE_REQUESTED',
      entity_type: 'PLAN_REQUEST',
      entity_id: newRequest.id,
      details: {
        planId: targetPlan.id,
        planName: targetPlan.name,
        billingCycle,
        requestedAt: new Date()
      }
    });

    RealtimeService.adminEvent('plan_request', {
      id: newRequest.id,
      restaurantId,
      planId: targetPlan.id,
      planName: targetPlan.name,
      billingCycle
    });

    res.status(200).json({
      success: true,
      message: `Request for ${targetPlan.name} plan (${billingCycle}) sent successfully. Pending platform admin approval.`,
      data: {
        request: newRequest,
        plan: targetPlan
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error renewing subscription:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * PATCH /api/restaurant/orders/items/:id/quantity
 * Waiter adjustment of live order items (partial or complete unavailability)
 * Strict role check: Waiters only! Restaurant administrators must not directly edit live items.
 */
exports.updateOrderItemQuantity = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;
    const { acceptedQuantity, reason } = req.body;

    // Allow assigned/authorized waiters and restaurant owners/admins to edit live order items
    if (
      req.user.userType !== 'STAFF' &&
      req.user.role !== 'RESTAURANT_STAFF' &&
      req.user.userType !== 'ADMIN' &&
      req.user.role !== 'RESTAURANT_OWNER'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only assigned or authorized waiters may edit live order items.'
      });
    }

    if (acceptedQuantity === undefined || acceptedQuantity === null) {
      return res.status(400).json({ success: false, message: 'Accepted quantity is required.' });
    }

    const result = await OrderService.updateOrderItemQuantity({
      itemId: id,
      acceptedQuantity: parseInt(acceptedQuantity, 10),
      reason: reason || '',
      waiterId: req.user.id,
      restaurantId
    });

    RealtimeService.orderItemUpdated({
      restaurantId,
      orderId: result.order?.id,
      visitId: result.visit?.id,
      tableId: result.visit?.table_id,
      item: {
        id: result.item.id,
        name: result.item.item_name,
        requestedQuantity: result.item.requested_quantity,
        acceptedQuantity: result.item.accepted_quantity,
        unitPrice: parseFloat(result.item.unit_price),
        total: parseFloat(result.item.total),
        status: result.item.item_status,
        rejectionReason: result.item.rejection_reason,
        modifiedAt: result.item.modified_at
      }
    });

    res.status(200).json({
      success: true,
      message: 'Item quantity updated successfully.',
      data: result
    });
  } catch (error) {
    console.error('[RestaurantController] Error updating item quantity:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * POST /api/restaurant/tables/:tableId/cancel-allocation
 * Waiter cancellation of an allocated table visit
 */
exports.cancelTableAllocation = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { tableId } = req.params;
    const { reason, visitId } = req.body;

    const result = await CustomerSessionService.cancelAllocation({
      tableId,
      visitId,
      restaurantId,
      cancelledByUserId: req.user.id,
      reason: reason || 'Cancelled by staff'
    });

    RealtimeService.allocationCancelled({
      restaurantId,
      tableId,
      visitId: result.visit?.id,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Table allocation cancelled and table released.',
      data: result
    });
  } catch (error) {
    console.error('[RestaurantController] Error cancelling table allocation:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * POST /api/restaurant/visits/:id/complete
 * Waiter final "Order Completed" action closing visit and releasing table
 */
exports.completeVisit = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params; // visitId

    const result = await CustomerSessionService.completeVisit({
      visitId: id,
      restaurantId,
      closedByUserId: req.user.id
    });

    RealtimeService.visitClosed({
      restaurantId,
      tableId: result.tableId,
      visitId: result.visit.id
    });

    res.status(200).json({
      success: true,
      message: 'Visit completed, billing finalized, and table released.',
      data: {
        visit: result.visit
      }
    });
  } catch (error) {
    console.error('[RestaurantController] Error completing visit:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
};

