import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Flame,
  Sparkles,
  ShoppingBag,
  Bell,
  RefreshCw,
  AlertCircle,
  Receipt,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Phone
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';
import { io } from 'socket.io-client';
import ServiceRequestModal from '../../components/customer/ServiceRequestModal';

export default function Orders() {
  const navigate = useNavigate();
  const { session, myOrders, addToCart, setLiveOrdersCount, resetDiningSession } = useRestaurant();
  const [ordersData, setOrdersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('LIVE'); // 'LIVE' | 'PAST'
  const [copiedId, setCopiedId] = useState(null);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState('');
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});

  const tableId = session?.table?.id || session?.table?.tableId || '';
  const tableNumber = session?.table?.tableNumber || '';
  const restaurantName = session?.restaurant?.name || 'Restaurant';

  // Toggle order items expansion
  const toggleExpand = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Copy order number helper
  const handleCopy = (orderNumber) => {
    navigator.clipboard.writeText(orderNumber);
    setCopiedId(orderNumber);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const initialPhone = localStorage.getItem('customerPhone') || session?.customerPhone || '';
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [searchedPhone, setSearchedPhone] = useState(initialPhone);

  const getLast10Digits = (val) => (val ? String(val).replace(/\D/g, '').slice(-10) : '');

  // Fetch orders from API - fetch this user's orders by orderIds and/or phone
  const fetchOrders = useCallback(async (isSilent = false, overridePhone = null) => {
    if (!isSilent) setRefreshing(true);

    try {
      const orderIdsQuery = myOrders.join(',');
      const phoneToUse = (overridePhone !== null ? overridePhone : (searchedPhone || localStorage.getItem('customerPhone') || session?.customerPhone || '')).trim();
      const params = new URLSearchParams();
      if (orderIdsQuery) params.append('orderIds', orderIdsQuery);
      if (phoneToUse) params.append('phone', phoneToUse);

      // If we have neither order IDs nor phone, customer has no orders yet
      if (!orderIdsQuery && !phoneToUse) {
        setOrdersData([]);
        if (setLiveOrdersCount) setLiveOrdersCount(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const url = `${import.meta.env.VITE_API_URL}/public/orders?${params.toString()}`;
      const res = await fetch(url, { headers: getTenantHeaders() });
      const data = await res.json();

      if (data.success && Array.isArray(data.data?.orders)) {
        const sorted = data.data.orders.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setOrdersData(sorted);

        // Update live orders count in context
        const liveCount = sorted.filter(
          o => !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        ).length;
        if (setLiveOrdersCount) {
          setLiveOrdersCount(liveCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myOrders, searchedPhone, session?.customerPhone, setLiveOrdersCount]);

  // Initial fetch and polling fallback
  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => fetchOrders(true), 3000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Socket.IO real-time connection
  useEffect(() => {
    const socketUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '') || undefined;
    const token = localStorage.getItem('token');
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      auth: token ? { token } : {},
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      // Join table room if table is known
      if (tableId) {
        socket.emit('customer:join_table', tableId);
      }
      // Join individual order rooms
      myOrders.forEach(id => {
        if (id) socket.emit('customer:join', id);
      });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('order_updated', (updatedOrder) => {
      if (!updatedOrder) return;
      const updatedId = (updatedOrder.id || updatedOrder._id)?.toString();

      setOrdersData(prev => {
        const exists = prev.some(o => (o.id || o._id)?.toString() === updatedId);
        let updatedList;
        if (exists) {
          updatedList = prev.map(o =>
            (o.id || o._id)?.toString() === updatedId ? { ...o, ...updatedOrder } : o
          );
        } else {
          updatedList = [updatedOrder, ...prev];
        }

        const liveCount = updatedList.filter(
          o => !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        ).length;
        if (setLiveOrdersCount) setLiveOrdersCount(liveCount);

        return updatedList;
      });
    });

    socket.on('more_items_added', (updatedOrder) => {
      fetchOrders(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [tableId, myOrders, setLiveOrdersCount]);

  // Reorder functionality: re-add past order items to cart
  const handleReorder = (order) => {
    if (!order.items || order.items.length === 0) return;

    let addedCount = 0;
    order.items.forEach(item => {
      addToCart({
        menuItemId: item.menuItemId || item.id,
        name: item.itemName,
        price: item.unitPrice,
        size: item.size || null,
        quantity: item.quantity || 1
      });
      addedCount += item.quantity || 1;
    });

    setReorderSuccessMsg(`Added ${addedCount} items to your cart!`);
    setTimeout(() => setReorderSuccessMsg(''), 4000);
  };

  // Filter orders - match mobile number (user input) or order IDs
  const currentSavedPhone = searchedPhone || localStorage.getItem('customerPhone') || session?.customerPhone || '';
  const target10 = getLast10Digits(currentSavedPhone);

  const liveOrders = ordersData.filter(
    o => !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
  );

  const pastOrders = ordersData.filter(o => {
    const isPast = ['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status);
    if (!isPast) return false;

    // Match by phone number digits if provided (where mobile number = user input)
    if (target10) {
      const orderPhone10 = getLast10Digits(o.customerPhone);
      if (orderPhone10 && orderPhone10 === target10) return true;
    }
    // Also include if order was created on this device in the active session
    return myOrders.includes(o.id || o._id);
  });

  const displayedOrders = tab === 'LIVE' ? liveOrders : pastOrders;

  const handlePhoneSubmit = (e) => {
    e?.preventDefault();
    const trimmed = phoneInput.trim();
    setSearchedPhone(trimmed);
    if (trimmed) {
      try { localStorage.setItem('customerPhone', trimmed); } catch {}
    }
    fetchOrders(false, trimmed);
  };

  // Status visual mapping
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return {
          label: 'Order Placed',
          desc: 'Waiting for kitchen to accept',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
          icon: Clock
        };
      case 'READ':
      case 'CONFIRMED':
      case 'ACCEPTED':
        return {
          label: 'Order Confirmed',
          desc: 'Waiter has accepted your order',
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          dot: 'bg-blue-500',
          icon: CheckCircle2
        };
      case 'PREPARING':
        return {
          label: 'Cooking Now',
          desc: 'Chef is preparing your fresh meal',
          bg: 'bg-orange-50 text-orange-800 border-orange-200',
          dot: 'bg-orange-500',
          icon: Flame
        };
      case 'READY':
        return {
          label: 'Ready to Serve',
          desc: 'On its way to your table!',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: Sparkles
        };
      case 'COMPLETED':
      case 'PAID':
        return {
          label: 'Completed',
          desc: 'Delivered & served',
          bg: 'bg-green-50 text-green-800 border-green-200',
          dot: 'bg-green-600',
          icon: CheckCircle2
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          desc: 'This order was cancelled',
          bg: 'bg-red-50 text-red-800 border-red-200',
          dot: 'bg-red-500',
          icon: AlertCircle
        };
      default:
        return {
          label: status,
          desc: '',
          bg: 'bg-gray-100 text-gray-700 border-gray-200',
          dot: 'bg-gray-400',
          icon: Clock
        };
    }
  };

  // Stepper helper for live orders
  const getStepperIndex = (status) => {
    if (status === 'PENDING' || status === 'SUBMITTED' || status === 'ORDERED') return 1;
    if (status === 'READ' || status === 'CONFIRMED' || status === 'ACCEPTED') return 2;
    if (status === 'PREPARING') return 3;
    if (status === 'READY') return 4;
    if (status === 'COMPLETED' || status === 'PAID') return 5;
    return 1;
  };

  const steps = [
    { title: 'Placed', icon: Clock },
    { title: 'Confirmed', icon: CheckCircle2 },
    { title: 'Cooking', icon: Flame },
    { title: 'Ready', icon: Sparkles }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* ── Top Header ── */}
      <header className="bg-white px-4 py-3.5 shadow-xs sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer text-gray-700"
            aria-label="Back to Menu"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">My Orders</h1>
              {socketConnected && (
                <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {restaurantName} {tableNumber && `· Table ${tableNumber}`}
            </p>
          </div>
        </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchOrders(false)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh orders"
              aria-label="Refresh orders"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin text-emerald-600' : ''} />
            </button>
            <Link
              to="/cart"
              className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-gray-100 rounded-xl transition-colors"
              title="Cart"
            >
              <ShoppingBag size={18} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Reorder Toast Banner ── */}
      {reorderSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200 sticky top-[57px] z-20 shadow-md">
          <div className="flex items-center gap-2">
            <Check size={16} />
            <span>{reorderSuccessMsg}</span>
          </div>
          <Link
            to="/cart"
            className="underline font-bold text-white hover:text-emerald-100 ml-2"
          >
            View Cart →
          </Link>
        </div>
      )}

      {/* ── Tabs (Live Orders vs Past Orders) ── */}
      <div className="bg-white border-b border-gray-100 px-4 sticky top-[57px] z-10">
        <div className="max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto w-full flex gap-6">
        <button
          onClick={() => setTab('LIVE')}
          className={`py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            tab === 'LIVE'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <span>Live Orders</span>
          {liveOrders.length > 0 ? (
            <span className="bg-emerald-600 text-white text-[11px] px-2 py-0.5 rounded-full font-extrabold animate-pulse">
              {liveOrders.length}
            </span>
          ) : (
            <span className="bg-gray-100 text-gray-500 text-[11px] px-2 py-0.5 rounded-full font-medium">
              0
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('PAST')}
          className={`py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            tab === 'PAST'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          }`}
        >
          <span>Past Orders</span>
          <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
            Coming Soon
          </span>
        </button>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <main className="flex-1 p-4 sm:p-6 pb-28 max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto w-full space-y-4">
        {tab === 'PAST' ? (
          <div className="text-center py-20 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm mt-4 flex flex-col items-center">
            <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mb-5 text-amber-600 shadow-inner">
              <Clock size={36} className="animate-pulse" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full mb-3 border border-amber-200">
              <Sparkles size={13} className="text-amber-600" />
              <span>Coming Soon...</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Past Orders</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6 leading-relaxed">
              Past orders tracking and history will be available in a future update!
            </p>
            <button
              onClick={() => setTab('LIVE')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all text-sm cursor-pointer"
            >
              <UtensilsCrossed size={16} />
              <span>View Live Orders</span>
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-3">
            <Loader2 className="animate-spin w-9 h-9 text-emerald-600" />
            <p className="text-sm font-medium text-gray-500">Retrieving your orders…</p>
          </div>
        ) : liveOrders.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 px-6 bg-white rounded-3xl border border-gray-100 shadow-sm mt-4">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
              <UtensilsCrossed size={36} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              No Live Orders
            </h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
              You do not have any active meals currently in prep or cooking for this table.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all text-sm"
            >
              <UtensilsCrossed size={16} />
              <span>Explore Restaurant Menu</span>
            </Link>
          </div>
        ) : (
          /* Orders List */
          <div className="space-y-4">
            {displayedOrders.map((order, idx) => {
              const orderId = order.id || order._id || idx;
              const badge = getStatusBadge(order.status);
              const BadgeIcon = badge.icon;
              const currentStepIndex = getStepperIndex(order.status);
              const isLive = tab === 'LIVE';
              const isExpanded = expandedOrders[orderId] !== false; // default open

              return (
                <div
                  key={orderId}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
                >
                  {/* Card Header: Order Number & Live Status Badge */}
                  <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Order
                        </span>
                        <p className="font-extrabold text-gray-900 text-sm tracking-tight flex items-center gap-1.5">
                          {order.orderNumber || `#${String(orderId).substring(0, 8)}`}
                          <button
                            onClick={() => handleCopy(order.orderNumber || orderId)}
                            className="text-gray-400 hover:text-emerald-600 transition-colors p-0.5"
                            title="Copy Order #"
                          >
                            {copiedId === (order.orderNumber || orderId) ? (
                              <Check size={13} className="text-emerald-600" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        {order.tableNumber && ` · Table ${order.tableNumber}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${isLive ? 'animate-pulse' : ''}`}></span>
                        <BadgeIcon size={13} />
                        <span>{badge.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Live Progress Stepper (Only for Live Orders) */}
                  {isLive && (
                    <div className="px-5 pt-5 pb-4 bg-gradient-to-b from-white to-gray-50/40 border-b border-gray-100">
                      <div className="relative flex items-center justify-between mb-2">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-gray-100 rounded-full z-0">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((currentStepIndex - 1) / 3) * 100))}%`
                            }}
                          />
                        </div>

                        {/* Steps */}
                        {steps.map((st, sIdx) => {
                          const stepNumber = sIdx + 1;
                          const isDone = currentStepIndex > stepNumber;
                          const isCurrent = currentStepIndex === stepNumber;
                          const StepIcon = st.icon;

                          return (
                            <div key={st.title} className="relative z-10 flex flex-col items-center">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                  isDone
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : isCurrent
                                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 shadow-md animate-pulse'
                                    : 'bg-white text-gray-300 border-2 border-gray-200'
                                }`}
                              >
                                {isDone ? (
                                  <Check size={14} className="stroke-[3]" />
                                ) : (
                                  <StepIcon size={14} />
                                )}
                              </div>
                              <span
                                className={`text-[10px] mt-1.5 font-bold tracking-tight ${
                                  isCurrent
                                    ? 'text-emerald-700'
                                    : isDone
                                    ? 'text-gray-700'
                                    : 'text-gray-400'
                                }`}
                              >
                                {st.title}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Informational Sub-status Message */}
                      <div className="mt-3 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 flex items-center gap-2">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                        <p className="text-xs font-semibold text-emerald-900 leading-tight">
                          {badge.desc || 'Order is being processed.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Items List (Collapsible / Expandable) */}
                  <div className="p-4">
                    <button
                      onClick={() => toggleExpand(orderId)}
                      className="w-full flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 cursor-pointer hover:text-gray-700 transition-colors"
                    >
                      <span>
                        Items Ordered ({order.items?.length || 0})
                      </span>
                      <div className="flex items-center gap-1 text-gray-400 text-xs normal-case font-medium">
                        <span>{isExpanded ? 'Hide' : 'Show details'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="space-y-2.5 pt-1">
                        {order.items?.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-none"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <span className="bg-emerald-50 text-emerald-800 text-xs font-extrabold px-2 py-0.5 rounded-lg shrink-0 border border-emerald-200">
                                {item.quantity}×
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-800 truncate text-xs sm:text-sm">
                                  {item.itemName}
                                </p>
                                {item.size && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded inline-block">
                                    {item.size}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="font-bold text-gray-700 text-xs sm:text-sm shrink-0">
                              ₹{Number(item.subtotal ?? item.total ?? ((item.unitPrice || item.price || 0) * (item.quantity || 1)) ?? 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bill Breakdown & Grand Total */}
                  <div className="p-4 bg-gray-50/60 border-t border-gray-100 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Subtotal</span>
                      <span>₹{Number(order.subtotal ?? order.total ?? 0).toFixed(2)}</span>
                    </div>

                    {Number(order.taxAmount) > 0 && (
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Taxes & Charges ({order.taxPercent || 0}%)</span>
                        <span>₹{Number(order.taxAmount).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-extrabold text-base text-gray-900">
                      <span className="text-xs uppercase tracking-wider text-gray-600">Total Paid / Bill</span>
                      <span className="text-emerald-700">₹{Number(order.total ?? order.final_amount ?? order.total_amount ?? 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
                    {isLive ? (
                      <>
                        <button
                          onClick={() => setIsServiceModalOpen(true)}
                          className="flex-1 py-2.5 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-gray-200 cursor-pointer"
                        >
                          <Bell size={14} className="text-emerald-600" />
                          <span>Call Waiter</span>
                        </button>
                        <Link
                          to="/"
                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-200"
                        >
                          <UtensilsCrossed size={14} />
                          <span>Add More Items</span>
                        </Link>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleReorder(order)}
                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-200 cursor-pointer"
                        >
                          <ShoppingBag size={14} />
                          <span>Reorder All Items</span>
                        </button>
                        <Link
                          to="/feedback"
                          className="py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200 text-center"
                        >
                          Feedback
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Fixed Bottom Actions Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-3 shadow-lg z-20">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <Link
            to="/"
            className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <UtensilsCrossed size={16} />
            <span>Browse Full Menu</span>
          </Link>

          <Link
            to="/cart"
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-colors"
          >
            <ShoppingBag size={16} />
            <span>View Cart</span>
          </Link>
        </div>
      </div>

      {/* ── Instant Call Waiter / Service Request Modal ── */}
      <ServiceRequestModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
      />
    </div>
  );
}
