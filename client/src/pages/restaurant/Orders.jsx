import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock, Search, X } from 'lucide-react';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('LIVE'); // 'LIVE' or 'PAST'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('ALL');
  const [historyPolicy, setHistoryPolicy] = useState({ days: null, planName: null, loaded: false });

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    const hostname = window.location.hostname;
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    let subdomain = '';
    if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in') {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('localhost') && hostname !== 'localhost') {
      subdomain = hostname.split('.')[0];
    }
    if (subdomain) headers['x-tenant-subdomain'] = subdomain;
    return headers;
  };

  useEffect(() => {
    fetchOrders();

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
    const socket = io(socketUrl, {
      withCredentials: true,
      auth: { token },
    });

    socket.on('connect', () => {
      setConnected(true);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // The server joins the correct rooms from the auth token; these calls
        // are kept for backwards compatibility with older deployments.
        socket.emit('restaurant:join', payload.restaurantId);
        socket.emit('waiter:join', { restaurantId: payload.restaurantId, waiterId: payload.id });
      } catch (err) {
        console.error("Failed to decode token", err);
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('new_order', (orderPayload) => {
      setOrders(prev => [
        {
          ...orderPayload,
          id: orderPayload.id || orderPayload._id,
        },
        ...prev
      ]);
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));
      } catch(e){}
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder._id || o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
    });

    socket.on('more_items_added', (updatedOrder) => {
      setOrders(prev => prev.map(o => (o.id === (updatedOrder._id || updatedOrder.id) || o._id === (updatedOrder._id || updatedOrder.id)) ? { ...o, ...updatedOrder } : o));
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));
      } catch(e){}
    });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        // Map backend _id to id if necessary
        const mappedOrders = data.data.orders.map(o => ({ ...o, id: o._id }));
        setOrders(mappedOrders);
        setHistoryPolicy({
          days: data.data.orderHistoryDays ?? null,
          planName: data.data.planName || null,
          loaded: true
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toDateKey = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const formatOrderDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatOrderTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Live orders are anything not COMPLETED or CANCELLED
  const liveOrders = orders.filter(o => !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status));
  const pastOrders = orders.filter(o => ['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status));

  const getOrderTable = (order) => String(order.tableNumber || order.tableId?.tableNumber || 'Takeaway');

  const tableOptions = Array.from(new Set(pastOrders.map(getOrderTable)))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const filteredPastOrders = pastOrders.filter(o => {
    if (statusFilter !== 'ALL' && (o.status || '').toUpperCase() !== statusFilter) return false;
    if (dateFilter && toDateKey(o.createdAt) !== dateFilter) return false;
    if (tableFilter !== 'ALL' && getOrderTable(o) !== tableFilter) return false;
    return true;
  });

  const hasPastFilters = statusFilter !== 'ALL' || dateFilter !== '' || tableFilter !== 'ALL';

  const clearPastFilters = () => {
    setStatusFilter('ALL');
    setDateFilter('');
    setTableFilter('ALL');
  };

  const displayOrders = (activeTab === 'LIVE' ? liveOrders : filteredPastOrders).filter(o => {
    const searchString = `${o.orderNumber || ''} ${o.tableNumber || ''} ${o.assignedWaiter?.name || o.waiterName || ''} ${o.customerName || ''} ${o.customerPhone || ''}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  const formatHistoryWindow = (days) => {
    if (days === 365) return '1 year';
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Orders Management</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 flex items-center gap-2">
            View live and past orders
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${connected ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              {connected ? 'Real-time active' : 'Offline'}
            </span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search by phone, table, order, waiter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-full text-sm"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            className={`flex-1 py-4 font-medium text-center transition-colors ${activeTab === 'LIVE' ? 'text-green-500 border-b-2 border-green-500 bg-green-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('LIVE')}
          >
            Live Orders ({liveOrders.length})
          </button>
          <button
            className={`flex-1 py-4 font-medium text-center transition-colors ${activeTab === 'PAST' ? 'text-green-500 border-b-2 border-green-500 bg-green-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('PAST')}
          >
            Past Orders ({pastOrders.length})
          </button>
        </div>

        <div className="p-3 sm:p-6">
          {activeTab === 'PAST' && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="past-status-filter" className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Status
                  </label>
                  <select
                    id="past-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PAID">Paid</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="past-date-filter" className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Date
                  </label>
                  <input
                    id="past-date-filter"
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label htmlFor="past-table-filter" className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Table
                  </label>
                  <select
                    id="past-table-filter"
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="ALL">All Tables</option>
                    {tableOptions.map((table) => (
                      <option key={table} value={table}>
                        {table === 'Takeaway' ? 'Takeaway' : `Table ${table}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500">
                  Showing <span className="font-semibold text-gray-700">{displayOrders.length}</span> of {pastOrders.length} past orders
                </p>
                <button
                  type="button"
                  onClick={clearPastFilters}
                  disabled={!hasPastFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <X size={14} /> Clear filters
                </button>
              </div>
            </div>
          )}
          {activeTab === 'PAST' && historyPolicy.loaded && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
              <Clock size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <p>
                {historyPolicy.days === null || historyPolicy.days === undefined
                  ? `Your ${historyPolicy.planName || 'current'} plan includes unlimited order history.`
                  : `Showing the last ${formatHistoryWindow(historyPolicy.days)} of order history for your ${historyPolicy.planName || 'current'} plan. Older orders are hidden.`}
              </p>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            </div>
          ) : displayOrders.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Clock size={48} className="mx-auto mb-4 opacity-50" />
              <p>
                {activeTab === 'PAST' && hasPastFilters
                  ? 'No past orders match the selected filters.'
                  : 'No orders found for the selected category.'}
              </p>
              {activeTab === 'PAST' && hasPastFilters && (
                <button
                  type="button"
                  onClick={clearPastFilters}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Table</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Waiter</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      {activeTab === 'PAST' ? 'Date' : 'Time'}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{order.orderNumber || order.id?.substring(0,8)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">Table {order.tableNumber}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {order.assignedWaiter?.name || order.waiterName ? (
                          <div className="flex items-center gap-1.5 font-medium text-gray-900">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>{order.assignedWaiter?.name || order.waiterName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-xs truncate text-sm text-gray-600">
                          {order.items?.map(i => `${i.quantity || i.qty}x ${i.itemName || i.name}`).join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">₹{order.total}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'PENDING' || order.status === 'NEW' ? 'bg-amber-100 text-amber-700' :
                          order.status === 'READ' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'PREPARING' ? 'bg-yellow-100 text-yellow-700' :
                          order.status === 'READY' ? 'bg-green-100 text-green-700' :
                          order.status === 'SERVED' ? 'bg-indigo-100 text-indigo-700' :
                          order.status === 'COMPLETED' || order.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status === 'PENDING' ? 'NEW (UNREAD)' : order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {activeTab === 'PAST' ? (
                          <div>
                            <p className="font-medium text-gray-700">{formatOrderDate(order.createdAt)}</p>
                            <p className="text-xs text-gray-400">{formatOrderTime(order.createdAt)}</p>
                          </div>
                        ) : (
                          formatOrderTime(order.createdAt)
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        {activeTab === 'LIVE' && (
                          <div className="flex justify-end gap-2">
                            {order.status === 'PENDING' && (
                              <button 
                                onClick={() => updateOrderStatus(order.id, 'READ')}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Mark Read
                              </button>
                            )}
                            {order.status !== 'COMPLETED' && (
                                <button 
                                  onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                                >
                                  Complete (Free Table)
                                </button>
                            )}
                            <button 
                              onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                              className="text-red-600 hover:text-red-800 text-sm font-medium ml-2"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                        {activeTab === 'PAST' && (
                          <span className="text-gray-400 text-sm">Archived</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
