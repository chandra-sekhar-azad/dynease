const { db, schema } = require('../db/client');
const { eq, and, gte, lte } = require('drizzle-orm');
const { shifts, rosters, users } = schema;
const RealtimeService = require('../services/RealtimeService');

const SHIFT_TYPES = ['WORKING', 'HOLIDAY', 'LEAVE'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize a time string to HH:MM:SS (Postgres `time`).
 * Accepts "09:00", "09:00:00", "9:0", etc. Returns null when invalid.
 */
const normalizeTime = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) return null;
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  const ss = match[3] !== undefined ? parseInt(match[3], 10) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

const formatShift = (s) => ({
  _id: s.id,
  id: s.id,
  restaurantId: s.restaurant_id,
  name: s.name || '',
  startTime: (s.start_time || '').slice(0, 5),
  endTime: (s.end_time || '').slice(0, 5),
  createdAt: s.createdat,
  updatedAt: s.updatedat,
});

const formatRoster = (r) => ({
  _id: r.id,
  id: r.id,
  restaurantId: r.restaurant_id,
  userId: r.user_id,
  date: r.date,
  shiftId: r.shift_id,
  shiftType: r.shift_type,
  createdAt: r.createdat,
  updatedAt: r.updatedat,
});

// ─────────────────────────────────────────────────────────────
//  Shifts
// ─────────────────────────────────────────────────────────────

// GET /api/restaurant/shifts
exports.getShifts = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const rows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.restaurant_id, restaurantId))
      .orderBy(shifts.start_time);

    res.status(200).json({ success: true, data: { shifts: rows.map(formatShift) } });
  } catch (error) {
    next(error);
  }
};

// POST /api/restaurant/shifts
exports.createShift = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { name, startTime, endTime } = req.body;

    const start = normalizeTime(startTime);
    const end = normalizeTime(endTime);
    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'Valid start and end times are required (HH:MM).' });
    }
    if (end <= start) {
      return res.status(400).json({ success: false, message: 'End time must be after start time.' });
    }

    const [row] = await db.insert(shifts).values({
      restaurant_id: req.user.restaurantId,
      name: (name || '').trim() || null,
      start_time: start,
      end_time: end,
    }).returning();

    RealtimeService.rosterUpdated(restaurantId);

    res.status(201).json({ success: true, message: 'Shift created.', data: { shift: formatShift(row) } });
  } catch (error) {
    next(error);
  }
};

exports.updateShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(shifts).where(
      and(eq(shifts.id, id), eq(shifts.restaurant_id, req.user.restaurantId))
    ).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    const updateData = { updatedat: new Date() };
    if (req.body.name !== undefined) updateData.name = (req.body.name || '').trim() || null;
    if (req.body.startTime !== undefined) {
      const start = normalizeTime(req.body.startTime);
      if (!start) return res.status(400).json({ success: false, message: 'Invalid start time.' });
      updateData.start_time = start;
    }
    if (req.body.endTime !== undefined) {
      const end = normalizeTime(req.body.endTime);
      if (!end) return res.status(400).json({ success: false, message: 'Invalid end time.' });
      updateData.end_time = end;
    }

    const start = updateData.start_time || existing.start_time;
    const end = updateData.end_time || existing.end_time;
    if (end <= start) {
      return res.status(400).json({ success: false, message: 'End time must be after start time.' });
    }

    const [row] = await db.update(shifts).set(updateData).where(eq(shifts.id, id)).returning();
    RealtimeService.rosterUpdated(req.user.restaurantId);
    res.status(200).json({ success: true, message: 'Shift updated.', data: { shift: formatShift(row) } });
  } catch (error) {
    next(error);
  }
};

exports.deleteShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(shifts).where(
      and(eq(shifts.id, id), eq(shifts.restaurant_id, req.user.restaurantId))
    ).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    // Detach the shift from any roster entries before removing it
    await db.update(rosters).set({ shift_id: null, updatedat: new Date() }).where(eq(rosters.shift_id, id));
    await db.delete(shifts).where(eq(shifts.id, id));

    RealtimeService.rosterUpdated(req.user.restaurantId);

    res.status(200).json({ success: true, message: 'Shift deleted.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/restaurant/rosters?date=YYYY-MM-DD
 * GET /api/restaurant/rosters?from=YYYY-MM-DD&to=YYYY-MM-DD
 * GET /api/restaurant/rosters?userId=<uuid>
 */
exports.getRosters = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { date, from, to, userId } = req.query;

    const conditions = [eq(rosters.restaurant_id, restaurantId)];
    if (date) {
      if (!DATE_RE.test(date)) return res.status(400).json({ success: false, message: 'Invalid date (expected YYYY-MM-DD).' });
      conditions.push(eq(rosters.date, date));
    }
    if (from) conditions.push(gte(rosters.date, from));
    if (to) conditions.push(lte(rosters.date, to));
    if (userId) conditions.push(eq(rosters.user_id, userId));

    const rows = await db.select().from(rosters).where(and(...conditions)).orderBy(rosters.date);

    res.status(200).json({ success: true, data: { rosters: rows.map(formatRoster) } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/restaurant/rosters
 * Assign (or update) a staff member's roster for a given date.
 * Body: { userId, date, shiftId?, shiftType? }
 */
exports.upsertRoster = async (req, res, next) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { userId, date, shiftId, shiftType } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ success: false, message: 'userId and date are required.' });
    }
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date (expected YYYY-MM-DD).' });
    }

    const [staff] = await db.select().from(users).where(
      and(eq(users.id, userId), eq(users.restaurant_id, restaurantId), eq(users.is_deleted, false))
    ).limit(1);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }
    if (staff.user_type !== 'STAFF') {
      return res.status(400).json({ success: false, message: 'Rosters can only be assigned to staff members.' });
    }

    let resolvedShiftId = null;
    if (shiftId) {
      const [shift] = await db.select().from(shifts).where(
        and(eq(shifts.id, shiftId), eq(shifts.restaurant_id, restaurantId))
      ).limit(1);
      if (!shift) {
        return res.status(400).json({ success: false, message: 'Shift not found.' });
      }
      resolvedShiftId = shift.id;
    }

    const type = SHIFT_TYPES.includes(shiftType) ? shiftType : 'WORKING';

    const [row] = await db.insert(rosters).values({
      restaurant_id: restaurantId,
      user_id: userId,
      date,
      shift_id: resolvedShiftId,
      shift_type: type,
    }).onConflictDoUpdate({
      target: [rosters.user_id, rosters.date],
      set: { shift_id: resolvedShiftId, shift_type: type, updatedat: new Date() },
    }).returning();

    RealtimeService.rosterUpdated(restaurantId);

    res.status(200).json({ success: true, message: 'Roster saved.', data: { roster: formatRoster(row) } });
  } catch (error) {
    next(error);
  }
};

exports.deleteRoster = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(rosters).where(
      and(eq(rosters.id, id), eq(rosters.restaurant_id, req.user.restaurantId))
    ).limit(1);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Roster entry not found.' });
    }

    await db.delete(rosters).where(eq(rosters.id, id));
    RealtimeService.rosterUpdated(req.user.restaurantId);
    res.status(200).json({ success: true, message: 'Roster entry removed.' });
  } catch (error) {
    next(error);
  }
};
