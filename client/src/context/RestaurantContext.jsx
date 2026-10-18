import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setCookie, getCookie } from '../utils/cookies';

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
  const headers = { 
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
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

  // Cart: persisted per restaurant+table
  const cartKey = session
    ? `cart:${session.restaurant.slug}:${session.table.tableNumber}`
    : null;
  
  const [cart, setCart] = useState(() => {
    if (!cartKey) return [];
    try {
      const raw = localStorage.getItem(cartKey);
      return raw ? JSON.parse(raw) : [];
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
        setCart(raw ? JSON.parse(raw) : []);
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
    // item = { menuItemId, name, price, imageUrl, dietaryPreference, size }
    setCart(prev => {
      const existing = prev.find(i => 
        i.menuItemId === item.menuItemId && (i.size || '') === (item.size || '')
      );
      if (existing) {
        return prev.map(i =>
          i.menuItemId === item.menuItemId && (i.size || '') === (item.size || '')
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1, size: item.size || null }];
    });
  }, []);

  const removeFromCart = useCallback((menuItemId, size = null) => {
    setCart(prev => prev.filter(i => {
      if (size !== null) {
        return !(i.menuItemId === menuItemId && (i.size || '') === (size || ''));
      }
      return i.menuItemId !== menuItemId;
    }));
  }, []);

  const updateQuantity = useCallback((menuItemId, quantity, size = null) => {
    if (quantity < 1) {
      setCart(prev => prev.filter(i => {
        if (size !== null) {
          return !(i.menuItemId === menuItemId && (i.size || '') === (size || ''));
        }
        return i.menuItemId !== menuItemId;
      }));
    } else {
      setCart(prev =>
        prev.map(i => {
          const match = size !== null
            ? (i.menuItemId === menuItemId && (i.size || '') === (size || ''))
            : (i.menuItemId === menuItemId);
          return match ? { ...i, quantity } : i;
        })
      );
    }
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

  const refreshOrders = useCallback(async () => {
    if (!session && myOrders.length === 0) {
      setLiveOrdersCount(0);
      setLatestLiveOrder(null);
      return [];
    }

    try {
      const tableId = session?.table?.id || session?.table?.tableId || '';
      const orderIdsQuery = myOrders.join(',');
      const params = new URLSearchParams();
      if (orderIdsQuery) params.append('orderIds', orderIdsQuery);
      if (tableId) params.append('tableId', tableId);

      const url = `${import.meta.env.VITE_API_URL}/public/orders?${params.toString()}`;
      const res = await fetch(url, { headers: getTenantHeaders() });
      const data = await res.json();

      if (data.success && Array.isArray(data.data?.orders)) {
        const fetchedOrders = data.data.orders;

        // Sync any orders found by tableId back into myOrders
        fetchedOrders.forEach(o => {
          const oId = o.id || o._id;
          if (oId && !myOrders.includes(oId)) {
            addOrderId(oId);
          }
        });

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
  }, [session, myOrders, addOrderId]);

  // Initial and periodic check for live orders count
  useEffect(() => {
    refreshOrders();
    const interval = setInterval(refreshOrders, 3000);
    return () => clearInterval(interval);
  }, [session?.table?.id, myOrders.length]);

  return (
    <RestaurantContext.Provider value={{
      slug,
      session,
      saveSession,
      clearSession,
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
      refreshOrders
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
