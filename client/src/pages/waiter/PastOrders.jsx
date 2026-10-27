import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  RotateCw,
  ShoppingBag,
  Receipt,
  X,
  User,
  Phone,
  AlertCircle,
  IndianRupee,
  Utensils,
  CreditCard,
  Banknote,
  FileText,
  Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders, getStoredToken } from '../../utils/api';

export default function PastOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PAID' | 'CANCELLED'
  const [dateRange, setDateRange] = useState('ALL'); // 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [historyPolicy, setHistoryPolicy] = useState({ days: null, planName: null, loaded: false });

  const fetchPastOrders = async (isManualRefresh = false) => {
    const token = getStoredToken();
    if (!token) {
      navigate('/login');
      return;
    }

    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders?type=past`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.data?.orders) {
        setOrders(data.data.orders);
        setHistoryPolicy({
          days: data.data.orderHistoryDays ?? null,
          planName: data.data.planName || null,
          loaded: true
        });
      }
    } catch (err) {
      console.error('Failed to load past orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPastOrders();
    // Auto-refresh periodically every 30 seconds
    const interval = setInterval(() => fetchPastOrders(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter orders by search, status, and date range
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;
    const monthStart = todayStart - 30 * 86400000;

    return orders.filter(order => {
      // Status filter
      const st = (order.orderStatus || order.status || '').toUpperCase();
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'COMPLETED' && st !== 'COMPLETED') return false;
        if (statusFilter === 'PAID' && st !== 'PAID') return false;
        if (statusFilter === 'CANCELLED' && st !== 'CANCELLED') return false;
      }

      // Date range filter
      if (dateRange !== 'ALL') {
        const orderTime = new Date(order.createdAt || order.date).getTime();
        if (dateRange === 'TODAY' && orderTime < todayStart) return false;
        if (dateRange === 'YESTERDAY' && (orderTime < yesterdayStart || orderTime >= todayStart)) return false;
        if (dateRange === 'WEEK' && orderTime < weekStart) return false;
        if (dateRange === 'MONTH' && orderTime < monthStart) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (order.orderNumber || '').toLowerCase();
        const tbl = (order.tableNumber || order.tableId?.tableNumber || '').toLowerCase();
        const custName = (order.customerName || '').toLowerCase();
        const custPhone = (order.customerPhone || '').toLowerCase();
        const hasMatchingItem = order.items?.some(it =>
          (it.itemName || it.name || '').toLowerCase().includes(q)
        );

        if (!num.includes(q) && !tbl.includes(q) && !custName.includes(q) && !custPhone.includes(q) && !hasMatchingItem) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, dateRange, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const completedOrPaid = orders.filter(o => {
      const st = (o.orderStatus || o.status || '').toUpperCase();
      return st === 'COMPLETED' || st === 'PAID';
    });
    const cancelled = orders.filter(o => (o.orderStatus || o.status || '').toUpperCase() === 'CANCELLED');
    const totalRevenue = completedOrPaid.reduce((sum, o) => sum + (parseFloat(o.total || o.totalAmount || 0) || 0), 0);

    return {
      total: totalOrders,
      completed: completedOrPaid.length,
      cancelled: cancelled.length,
      revenue: totalRevenue
    };
  }, [orders]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const formatHistoryWindow = (days) => {
    if (days === 365) return '1 year';
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };

  const getStatusBadge = (status) => {
    const st = (status || '').toUpperCase();
    if (st === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 size={13} />
          Completed
        </span>
      );
    }
    if (st === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <CreditCard size={13} />
          Paid
        </span>
      );
    }
    if (st === 'CANCELLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <AlertCircle size={13} />
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
        {status}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-10 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-orange-600" size={26} />
              My Past Orders
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Review completed, paid, and historical orders served by you
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => fetchPastOrders(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh past orders"
            >
              <RotateCw size={16} className={refreshing ? 'animate-spin text-orange-600' : 'text-gray-500'} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between text-orange-700 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
              <Receipt size={18} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Completed / Paid</span>
              <CheckCircle2 size={18} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Cancelled</span>
              <AlertCircle size={18} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.cancelled}</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-100/50 border border-blue-200/80 rounded-2xl p-4">
            <div className="flex items-center justify-between text-blue-700 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Sales Served</span>
              <IndianRupee size={18} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.revenue)}</div>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, table, customer or item..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="inline-flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'PAID', label: 'Paid' },
                { id: 'CANCELLED', label: 'Cancelled' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-gray-900 shadow-xs font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Date Range Selector */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="appearance-none bg-white border border-gray-300 text-gray-700 text-xs font-medium py-2 pl-8 pr-8 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
              >
                <option value="ALL">
                  {historyPolicy.days === null || historyPolicy.days === undefined ? 'All Time' : 'All Available'}
                </option>
                <option value="TODAY">Today</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="WEEK">Last 7 Days</option>
                <option value="MONTH">Last 30 Days</option>
              </select>
              <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <Filter size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        {historyPolicy.loaded && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50/80 px-4 py-3 text-xs text-orange-900">
            <Clock size={16} className="mt-0.5 shrink-0 text-orange-600" />
            <p>
              {historyPolicy.days === null || historyPolicy.days === undefined
                ? `Your ${historyPolicy.planName || 'restaurant'} plan includes unlimited order history.`
                : `Your ${historyPolicy.planName || 'restaurant'} plan limits order history to the last ${formatHistoryWindow(historyPolicy.days)}. Older orders are hidden for all staff.`}
            </p>
          </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-orange-500 border-t-transparent mb-4" />
            <p className="text-sm font-medium text-gray-500">Loading your past orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200/80 p-12 text-center max-w-lg mx-auto shadow-xs my-8">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-600 shadow-inner">
              <Receipt size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Past Orders Found</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {searchQuery || statusFilter !== 'ALL' || dateRange !== 'ALL'
                ? 'No orders match your active filter criteria. Try adjusting your search query or filters.'
                : 'You have not completed any orders yet. Finished and paid orders will show up here.'}
            </p>
            {(searchQuery || statusFilter !== 'ALL' || dateRange !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setDateRange('ALL');
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium text-sm rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredOrders.map(order => {
              const itemsCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
              const displayTotal = parseFloat(order.total || order.totalAmount || 0);

              return (
                <div
                  key={order.id || order._id}
                  onClick={() => setSelectedOrder(order)}
                  className="bg-white rounded-2xl border border-gray-200/90 hover:border-orange-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg tracking-wide flex items-center gap-1.5 shadow-xs">
                          <Utensils size={12} className="text-orange-400" />
                          {order.tableNumber || order.tableId?.tableNumber || 'Table'}
                        </span>
                        <span className="font-mono text-xs font-bold text-gray-500">
                          {order.orderNumber || `ORD-${(order.id || '').slice(0, 8).toUpperCase()}`}
                        </span>
                      </div>
                      <div>{getStatusBadge(order.orderStatus || order.status)}</div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
                      <Clock size={13} />
                      <span>{formatDate(order.createdAt || order.date)}</span>
                    </div>

                    {/* Customer info if present */}
                    {(order.customerName || order.customerPhone) && (
                      <div className="mt-3 flex items-center gap-3 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                        {order.customerName && (
                          <div className="flex items-center gap-1 truncate font-medium">
                            <User size={12} className="text-gray-400 shrink-0" />
                            <span className="truncate">{order.customerName}</span>
                          </div>
                        )}
                        {order.customerPhone && (
                          <div className="flex items-center gap-1 text-gray-500 shrink-0">
                            <Phone size={11} className="text-gray-400" />
                            <span>{order.customerPhone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Order Items Preview */}
                  <div className="px-5 py-3 border-t border-gray-100 bg-slate-50/50 flex-1">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Items Summary</span>
                      <span className="text-gray-400 font-normal">{itemsCount} total</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-gray-700">
                      {(order.items || []).slice(0, 3).map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2">
                          <span className="truncate text-gray-800">
                            <strong className="text-orange-600 mr-1.5">{item.quantity || 1}x</strong>
                            {item.itemName || item.name}
                            {item.size ? (
                              <span className="text-gray-400 text-[11px] ml-1">({item.size})</span>
                            ) : null}
                          </span>
                          <span className="text-gray-600 font-medium shrink-0">
                            {formatCurrency(parseFloat(item.subtotal || item.total || (item.unitPrice * item.quantity)) || 0)}
                          </span>
                        </li>
                      ))}
                      {(order.items || []).length > 3 && (
                        <li className="text-[11px] text-gray-400 italic pt-0.5">
                          + {(order.items || []).length - 3} more items...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Card Footer */}
                  <div className="p-4 px-5 bg-white border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-gray-400 block uppercase">Total Bill</span>
                      <span className="text-lg font-black text-gray-900 tracking-tight">
                        {formatCurrency(displayTotal)}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold rounded-xl transition-colors cursor-pointer group-hover:bg-orange-600 group-hover:text-white"
                    >
                      <Receipt size={14} />
                      <span>View Receipt</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Order Receipt Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-orange-600 text-white text-xs font-bold rounded-md">
                    {selectedOrder.tableNumber || selectedOrder.tableId?.tableNumber || 'Table'}
                  </span>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {selectedOrder.orderNumber || `ORD-${(selectedOrder.id || '').slice(0, 8).toUpperCase()}`}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock size={12} />
                  {formatDate(selectedOrder.createdAt || selectedOrder.date)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Print receipt"
                >
                  <Printer size={18} />
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Close receipt"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 divide-y divide-gray-100">
              {/* Order Status & Customer Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Order Status</span>
                  <div>{getStatusBadge(selectedOrder.orderStatus || selectedOrder.status)}</div>
                </div>

                {(selectedOrder.customerName || selectedOrder.customerPhone) && (
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Customer</span>
                    <div className="text-sm font-bold text-gray-800">{selectedOrder.customerName || 'Guest'}</div>
                    {selectedOrder.customerPhone && (
                      <div className="text-xs text-gray-500 flex sm:justify-end items-center gap-1 mt-0.5">
                        <Phone size={11} />
                        {selectedOrder.customerPhone}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Special Instructions (if any) */}
              {selectedOrder.specialInstructions && (
                <div className="pt-4">
                  <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                    <FileText size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block mb-0.5">Special Instructions:</strong>
                      <span>{selectedOrder.specialInstructions}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Ordered Items</h4>
                <div className="bg-gray-50 rounded-2xl border border-gray-200/80 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200/70 bg-gray-100/70 text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-4">Item</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/50 text-gray-800">
                      {(selectedOrder.items || []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/80 transition-colors">
                          <td className="py-3 px-4 font-medium">
                            <div className="text-gray-900 font-semibold">{item.itemName || item.name}</div>
                            {item.size && (
                              <div className="text-gray-500 text-[11px] font-normal mt-0.5">Size/Customization: {item.size}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-gray-700">
                            {item.quantity || 1}
                          </td>
                          <td className="py-3 px-3 text-right text-gray-600">
                            {formatCurrency(parseFloat(item.unitPrice) || 0)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            {formatCurrency(parseFloat(item.total || item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1))) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bill Financial Breakdown */}
              <div className="pt-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(parseFloat(selectedOrder.subtotal || 0))}
                  </span>
                </div>
                {parseFloat(selectedOrder.taxAmount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Tax & Charges</span>
                    <span className="font-semibold text-gray-800">
                      {formatCurrency(parseFloat(selectedOrder.taxAmount || 0))}
                    </span>
                  </div>
                )}
                {parseFloat(selectedOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>Discount</span>
                    <span className="font-semibold">
                      - {formatCurrency(parseFloat(selectedOrder.discount || 0))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
                  <span>Final Amount</span>
                  <span className="text-orange-600">
                    {formatCurrency(parseFloat(selectedOrder.total || selectedOrder.totalAmount || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span className="flex items-center gap-1">
                    <Banknote size={14} className="text-gray-400" />
                    Payment Method:
                  </span>
                  <span className="font-semibold uppercase text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                    {selectedOrder.paymentMethod || 'CASH'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
