import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { setCookie, getCookie, deleteCookie } from '../utils/cookies';

const RestaurantContext = createContext(null);

/**
 * Derives the restaurant slug from the current hostname.
 * Production: tasty-bites.dynease.in → tasty-bites
 * Dev:        tasty-bites.localhost:5173 → tasty-bites
 */
export function getSubdomainSlug() {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in' && !hostname.startsWith('admin.')) {
    return hostname.split('.')[0];
  }
  if (hostname.includes('localhost') && hostname !== 'localhost') {
    const slug = hostname.split('.')[0];
    if (slug !== 'admin') return slug;
  }
  return null;
}

/**
 * Build the header object for API calls that need tenant context.
 */
export function getTenantHeaders(extra = {}) {
  const slug = getSubdomainSlug();
  const token = localStorage.getItem('token');
  const validToken = token && token !== 'undefined' && token !== 'null' && token.trim() !== '';
  if (token && !validToken) {
    try { localStorage.removeItem('token'); } catch {}
  }
  const headers = { 
    'Content-Type': 'application/json',
    ...(validToken ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extra 
  };
  if (slug) headers['x-tenant-subdomain'] = slug;
  return headers;
}

export function RestaurantProvider({ children }) {
  const slug = getSubdomainSlug();
  
  // Session: resolved after QR scan (persisted in sessionStorage and localStorage fallback)
  const [session, setSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`dynease-session:${slug}`) || localStorage.getItem(`dynease-session:${slug}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // Cart helper functions
  const normSize = (s) => (s ? String(s).trim().toLowerCase() : '');
  const sizeMatch = (s1, s2) => normSize(s1) === normSize(s2);
  const sanitizeQuantity = (qty) => Math.min(Math.max(1, Number(qty) || 1), 99);

  // Cart: persisted per restaurant+table
  const cartKey = session
    ? `cart:${session.restaurant.slug}:${session.table.tableNumber}`
    : null;
  
  const [cart, setCart] = useState(() => {
    if (!cartKey) return [];
    try {
      const raw = localStorage.getItem(cartKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(i => i && i.menuItemId && i.price > 0)
        .map(i => ({
          ...i,
          menuItemId: String(i.menuItemId),
          size: i.size ? String(i.size).trim() : null,
          quantity: sanitizeQuantity(i.quantity)
        }));
    } catch { return []; }
  });

  // Persist cart whenever it or the key changes
  useEffect(() => {
    if (cartKey) {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    }
  }, [cart, cartKey]);

  // Reload cart when session changes (after QR scan)
  useEffect(() => {
    if (cartKey) {
      try {
        const raw = localStorage.getItem(cartKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const sanitized = parsed
              .filter(i => i && i.menuItemId && i.price > 0)
              .map(i => ({
                ...i,
                menuItemId: String(i.menuItemId),
                size: i.size ? String(i.size).trim() : null,
                quantity: sanitizeQuantity(i.quantity)
              }));
            setCart(sanitized);
            return;
          }
        }
        setCart([]);
      } catch { setCart([]); }
    }
  }, [cartKey]);

  const saveSession = useCallback((restaurantData, tableData, qrToken) => {
    const newSession = { restaurant: restaurantData, table: tableData, qrToken };
    setSession(newSession);
    try {
      sessionStorage.setItem(`dynease-session:${restaurantData.slug}`, JSON.stringify(newSession));
      localStorage.setItem(`dynease-session:${restaurantData.slug}`, JSON.stringify(newSession));
    } catch {}
  }, []);

  const clearSession = useCallback(() => {
    if (slug) {
      sessionStorage.removeItem(`dynease-session:${slug}`);
      localStorage.removeItem(`dynease-session:${slug}`);
    }
    setSession(null);
    setCart([]);
  }, [slug]);

  // ── Cart helpers ──────────────────────────────────────────────

  const addToCart = useCallback((item) => {
    // item = { menuItemId, name, price, imageUrl, dietaryPreference, size, quantity }
    if (!item || !item.menuItemId) return;
    const targetId = String(item.menuItemId);
    const targetSize = item.size ? String(item.size).trim() : null;
    const addQty = sanitizeQuantity(item.quantity || 1);

    setCart(prev => {
      const existing = prev.find(i => 
        String(i.menuItemId) === targetId && sizeMatch(i.size, targetSize)
      );
      if (existing) {
        return prev.map(i =>
          String(i.menuItemId) === targetId && sizeMatch(i.size, targetSize)
            ? { ...i, quantity: Math.min(i.quantity + addQty, 99) }
            : i
        );
      }
      return [...prev, {
        ...item,
        menuItemId: targetId,
        size: targetSize,
        quantity: addQty
      }];
    });
  }, []);

  const removeFromCart = useCallback((menuItemId, size = null) => {
    const targetId = String(menuItemId);
    setCart(prev => prev.filter(i => {
      if (String(i.menuItemId) !== targetId) return true;
      if (size !== null && size !== undefined) {
        return !sizeMatch(i.size, size);
      }
      return false;
    }));
  }, []);

  const updateQuantity = useCallback((menuItemId, quantity, size = null) => {
    const targetId = String(menuItemId);
    const targetQty = Number(quantity);

    setCart(prev => {
      // Find matching items for this menuItemId
      const matchingItems = prev.filter(i => String(i.menuItemId) === targetId);
      if (matchingItems.length === 0) return prev;

      // Determine which item to update
      let targetItem = null;
      if (size !== null && size !== undefined) {
        targetItem = matchingItems.find(i => sizeMatch(i.size, size));
      } else if (matchingItems.length === 1) {
        targetItem = matchingItems[0];
      }

      if (!targetItem) {
        // Ambiguous: size was not provided and there are multiple sizes in cart
        return prev;
      }

      if (targetQty < 1) {
        return prev.filter(i => !(String(i.menuItemId) === targetId && sizeMatch(i.size, targetItem.size)));
      }

      const clampedQty = Math.min(targetQty, 99);
      return prev.map(i => {
        if (String(i.menuItemId) === targetId && sizeMatch(i.size, targetItem.size)) {
          return { ...i, quantity: clampedQty };
        }
        return i;
      });
    });
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // ── Orders tracking via Cookies (with localStorage sync) ──
  const myOrdersKey = session
    ? `orders_${session.restaurant.slug}_${session.table.tableNumber}`
    : null;
    
  const [myOrders, setMyOrders] = useState(() => {
    if (!myOrdersKey) return [];
    try {
      // 1. Check cookies first
      const cookieData = getCookie(myOrdersKey);
      if (Array.isArray(cookieData) && cookieData.length > 0) return cookieData;
      
      // 2. Fallback to localStorage
      const raw = localStorage.getItem(myOrdersKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (myOrdersKey) {
      // Store in cookies for 30 days
      setCookie(myOrdersKey, myOrders, 30);
      // Keep localStorage synchronized
      try {
        localStorage.setItem(myOrdersKey, JSON.stringify(myOrders));
      } catch {}
    }
  }, [myOrders, myOrdersKey]);

  useEffect(() => {
    if (myOrdersKey) {
      try {
        const cookieData = getCookie(myOrdersKey);
        if (Array.isArray(cookieData) && cookieData.length > 0) {
          setMyOrders(cookieData);
        } else {
          const raw = localStorage.getItem(myOrdersKey);
          setMyOrders(raw ? JSON.parse(raw) : []);
        }
      } catch { setMyOrders([]); }
    }
  }, [myOrdersKey]);

  const addOrderId = useCallback((id) => {
    setMyOrders(prev => {
      if (!prev.includes(id)) {
        const updated = [id, ...prev];
        if (myOrdersKey) {
          setCookie(myOrdersKey, updated, 30);
          try {
            localStorage.setItem(myOrdersKey, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      }
      return prev;
    });
  }, [myOrdersKey]);

  // ── Live Orders state & real-time synchronization ──
  const [liveOrdersCount, setLiveOrdersCount] = useState(0);
  const [latestLiveOrder, setLatestLiveOrder] = useState(null);

  const resetDiningSession = useCallback((tableOrdersKey, cartKeyToClear) => {
    const oKey = tableOrdersKey || myOrdersKey;
    const cKey = cartKeyToClear || cartKey;
    if (oKey) {
      deleteCookie(oKey);
      try { localStorage.removeItem(oKey); } catch {}
    }
    if (cKey) {
      try { localStorage.removeItem(cKey); } catch {}
    }
    try {
      localStorage.removeItem('customerPhone');
      localStorage.removeItem('customerName');
    } catch {}
    setMyOrders([]);
    setCart([]);
    setLiveOrdersCount(0);
    setLatestLiveOrder(null);
  }, [myOrdersKey, cartKey]);

  const refreshOrders = useCallback(async () => {
    if (myOrders.length === 0) {
      setLiveOrdersCount(0);
      setLatestLiveOrder(null);
      return [];
    }

    try {
      const orderIdsQuery = myOrders.join(',');
      const params = new URLSearchParams();
      if (orderIdsQuery) params.append('orderIds', orderIdsQuery);

      const url = `${import.meta.env.VITE_API_URL}/public/orders?${params.toString()}`;
      const res = await fetch(url, { headers: getTenantHeaders(), credentials: 'include' });
      const data = await res.json();

      if (data.success && Array.isArray(data.data?.orders)) {
        const fetchedOrders = data.data.orders;

        const active = fetchedOrders.filter(o => 
          !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        );

        setLiveOrdersCount(active.length);
        setLatestLiveOrder(active.length > 0 ? active[0] : null);
        return fetchedOrders;
      }
    } catch (e) {
      console.warn('Could not refresh orders:', e);
    }
    return [];
  }, [myOrders]);

  // Initial and periodic check for live orders count
  useEffect(() => {
    refreshOrders();
    const interval = setInterval(refreshOrders, 3000);
    return () => clearInterval(interval);
  }, [refreshOrders]);

  // Real-time table session synchronization
  const [sessionAlert, setSessionAlert] = useState(null);

  useEffect(() => {
    if (!session?.table?.id) return;

    let socket;
    try {
      const socketUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
      socket = io(socketUrl, { withCredentials: true });

      socket.on('connect', () => {
        socket.emit('customer:join_table', session.table.id);
      });

      socket.on('allocation_cancelled', (payload) => {
        setSessionAlert({
          type: 'CANCELLED',
          title: 'Table Allocation Cancelled',
          message: payload.reason || 'Your table allocation was cancelled by staff. Please contact a waiter.'
        });
        resetDiningSession();
        clearSession();
      });

      socket.on('visit_closed', () => {
        setSessionAlert({
          type: 'COMPLETED',
          title: 'Visit Completed',
          message: 'Thank you for dining with us! Your table visit has been completed.'
        });
        resetDiningSession();
        clearSession();
      });

      socket.on('order_item_updated', () => {
        refreshOrders();
      });
    } catch (err) {
      // socket.io-client may be imported at top level if ESM
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [session?.table?.id, resetDiningSession, clearSession, refreshOrders]);

  return (
    <RestaurantContext.Provider value={{
      slug,
      session,
      saveSession,
      clearSession,
      resetDiningSession,
      cart,
      cartCount,
      cartSubtotal,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      myOrders,
      addOrderId,
      liveOrdersCount,
      setLiveOrdersCount,
      latestLiveOrder,
      setLatestLiveOrder,
      refreshOrders,
      sessionAlert,
      setSessionAlert
    }}>
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used inside RestaurantProvider');
  return ctx;
}
