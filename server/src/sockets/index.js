const jwt = require('jsonwebtoken');
const PostgresAdapter = require('../services/PostgresAdapter');

/**
 * Socket.IO room routing.
 *
 * The JWT only stores `{ id, sessionVersion }`, so the client cannot reliably
 * tell us which restaurant it belongs to. We therefore authenticate the socket
 * here and derive every privileged room from the *server side* user record.
 * Anonymous connections (customers) are still allowed and may only join the
 * `order:<id>` / `table:<id>` rooms using explicit ids.
 *
 * Rooms:
 *   restaurant:<restaurantId>   restaurant admin dashboards
 *   kitchen:<restaurantId>      kitchen display
 *   waiter:<restaurantId>       all waiters of a restaurant
 *   waiter_user:<userId>        a single waiter
 *   menu:<restaurantId>         public/customer menu viewers
 *   order:<orderId>             a customer tracking one order
 *   table:<tableId>             a customer session at a table
 *   admin:system                all system admins
 */
module.exports = (io) => {
  // Authenticate every connection when a token is supplied. Never reject —
  // customers connect anonymously — but only trusted sockets get a user.
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (token) {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod'
        );
        if (decoded?.id) {
          const user = await PostgresAdapter.findUserById(decoded.id);
          if (user) socket.data.user = user;
        }
      }
    } catch (err) {
      // Invalid/expired token → treat as anonymous instead of failing the
      // connection (the customer experience must never break).
    }
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const isSystemAdmin = user && (user.role === 'SUPER_ADMIN' || user.userType === 'SYSTEM_ADMIN');

    // Auto-join privileged rooms based on the authenticated identity.
    if (isSystemAdmin) {
      socket.join('admin:system');
    } else if (user?.restaurantId) {
      socket.join(`restaurant:${user.restaurantId}`);
      socket.join(`menu:${user.restaurantId}`);

      // Waiters / kitchen staff are restaurant staff.
      if (user.userType === 'STAFF' || user.role === 'RESTAURANT_STAFF') {
        socket.join(`waiter:${user.restaurantId}`);
        socket.join(`waiter_user:${user.id}`);
      }
    }

    console.log('A user connected:', socket.id, user ? `(${user.userType})` : '(anonymous)');

    // --- Privileged joins ---------------------------------------------------
    // Restaurant/kitchen/waiter rooms require an authenticated user of that
    // restaurant (system admins may target any restaurant). Anonymous clients
    // may only join the public menu room (and their own order/table rooms).
    const authedRestaurant = user?.restaurantId || null;
    const resolveRestaurant = (claimed, { allowAnonymous = false } = {}) => {
      if (isSystemAdmin) return claimed || null;
      if (authedRestaurant) return authedRestaurant;
      return allowAnonymous ? claimed : null;
    };

    socket.on('restaurant:join', (restaurantId) => {
      const rid = resolveRestaurant(restaurantId);
      if (rid) socket.join(`restaurant:${rid}`);
    });

    socket.on('kitchen:join', (restaurantId) => {
      const rid = resolveRestaurant(restaurantId);
      if (rid) socket.join(`kitchen:${rid}`);
    });

    socket.on('waiter:join', (payload = {}) => {
      const { restaurantId, waiterId } = payload || {};
      const rid = resolveRestaurant(restaurantId);
      const wid = user?.id || (rid ? waiterId : null);
      if (rid) socket.join(`waiter:${rid}`);
      if (wid) socket.join(`waiter_user:${wid}`);
    });

    socket.on('menu:join', (restaurantId) => {
      // Public menu data — anonymous customers may subscribe by restaurant id.
      const rid = resolveRestaurant(restaurantId, { allowAnonymous: true });
      if (rid) socket.join(`menu:${rid}`);
    });

    socket.on('admin:join', () => {
      if (isSystemAdmin) socket.join('admin:system');
    });

    // --- Anonymous customer joins ---
    socket.on('customer:join', (orderId) => {
      if (orderId) socket.join(`order:${orderId}`);
    });

    socket.on('customer:join_table', (tableId) => {
      if (tableId) socket.join(`table:${tableId}`);
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });
};
