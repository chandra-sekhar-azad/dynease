import React, { useState, useEffect } from 'react';
import { 
  Users, Loader2, ShoppingBag, Eye, X, Clock, CheckCircle2, 
  Flame, Sparkles, AlertCircle, RefreshCw, Search, Phone, Mail, 
  Store, UtensilsCrossed, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { authFetch } from '../../utils/api';

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForOrders, setSelectedUserForOrders] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [userOrdersData, setUserOrdersData] = useState({ liveOrders: [], pastOrders: [], totalOrders: 0 });
  const [activeOrderTab, setActiveOrderTab] = useState('LIVE'); // 'LIVE' | 'PAST'

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUserOrders = async (user) => {
    setSelectedUserForOrders(user);
    setActiveOrderTab('LIVE');
    setOrdersLoading(true);
    setUserOrdersData({ liveOrders: [], pastOrders: [], totalOrders: 0 });

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/users/${user._id || user.id}/orders`);
      const data = await res.json();
      if (data.success && data.data) {
        setUserOrdersData({
          liveOrders: data.data.liveOrders || [],
          pastOrders: data.data.pastOrders || [],
          totalOrders: data.data.totalOrders || 0
        });
        // Default to live tab if there are live orders, otherwise past
        if ((data.data.liveOrders || []).length === 0 && (data.data.pastOrders || []).length > 0) {
          setActiveOrderTab('PAST');
        }
      }
    } catch (err) {
      console.error('Error fetching user orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleRefreshUserOrders = async () => {
    if (!selectedUserForOrders) return;
    setOrdersLoading(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/users/${selectedUserForOrders._id || selectedUserForOrders.id}/orders`);
      const data = await res.json();
      if (data.success && data.data) {
        setUserOrdersData({
          liveOrders: data.data.liveOrders || [],
          pastOrders: data.data.pastOrders || [],
          totalOrders: data.data.totalOrders || 0
        });
      }
    } catch (err) {
      console.error('Error refreshing user orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.phone?.toLowerCase().includes(q) ||
      user.role?.toLowerCase().includes(q) ||
      user.restaurantId?.name?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Placed', bg: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' };
      case 'READ':
      case 'CONFIRMED':
        return { label: 'Confirmed', bg: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500' };
      case 'PREPARING':
        return { label: 'Cooking', bg: 'bg-orange-50 text-orange-800 border-orange-200', dot: 'bg-orange-500' };
      case 'READY':
        return { label: 'Ready', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' };
      case 'COMPLETED':
      case 'SERVED':
      case 'PAID':
        return { label: status, bg: 'bg-green-50 text-green-800 border-green-200', dot: 'bg-green-600' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' };
      default:
        return { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold font-serif text-gray-900 tracking-tight">Users Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            View registered platform users, customers, staff, and inspect user's live and past orders.
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-4 py-2 rounded-xl shadow-xs flex items-center gap-2">
          <Users size={18} className="text-emerald-700" />
          <span className="font-extrabold text-sm">{users.length} Total Users</span>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
        <Search size={18} className="text-gray-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by name, email, phone, or role..."
          className="w-full text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-gray-400 hover:text-gray-600 font-semibold cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Users Table ── */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Role</th>
                <th className="py-4 px-6">Phone</th>
                <th className="py-4 px-6">Restaurant</th>
                <th className="py-4 px-6 text-right">Orders Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredUsers.map(user => (
                <tr key={user._id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-4 px-6 font-semibold text-gray-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                        {user.name ? user.name[0] : 'U'}
                      </div>
                      <div>
                        <div>{user.name}</div>
                        <div className="text-[11px] text-gray-400 font-normal">ID: {String(user._id).substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{user.email}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                      user.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                      user.role === 'RESTAURANT_OWNER' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      user.role === 'CUSTOMER' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      user.role === 'RESTAURANT_STAFF' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{user.phone || '-'}</td>
                  <td className="py-4 px-6 text-gray-600">
                    {user.restaurantId?.name ? (
                      <span className="font-medium text-gray-800 flex items-center gap-1.5">
                        <Store size={14} className="text-gray-400" />
                        {user.restaurantId.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">None / Platform</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleOpenUserOrders(user)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition-all cursor-pointer shadow-xs"
                      title="View user's live and past orders"
                    >
                      <ShoppingBag size={14} />
                      <span>View Orders</span>
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <UtensilsCrossed size={36} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-medium">No users found matching "{searchQuery}"</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── User Orders Modal (Live Orders & Past Orders) ── */}
      {selectedUserForOrders && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="p-6 bg-gray-50/80 border-b border-gray-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <ShoppingBag size={20} />
                  </span>
                  <h3 className="text-lg font-bold text-gray-900">
                    User Orders: <span className="text-emerald-700">{selectedUserForOrders.name}</span>
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-gray-400" />
                    {selectedUserForOrders.email}
                  </span>
                  {selectedUserForOrders.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} className="text-gray-400" />
                      {selectedUserForOrders.phone}
                    </span>
                  )}
                  <span className="bg-gray-200/70 text-gray-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                    {selectedUserForOrders.role?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRefreshUserOrders}
                  disabled={ordersLoading}
                  className="p-2 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  title="Refresh orders"
                >
                  <RefreshCw size={18} className={ordersLoading ? 'animate-spin text-emerald-600' : ''} />
                </button>
                <button
                  onClick={() => setSelectedUserForOrders(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Tabs: Live Orders vs Past Orders */}
            <div className="bg-white border-b border-gray-100 px-6 flex gap-6">
              <button
                onClick={() => setActiveOrderTab('LIVE')}
                className={`py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeOrderTab === 'LIVE'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                <span>Live Orders</span>
                {userOrdersData.liveOrders.length > 0 ? (
                  <span className="bg-emerald-600 text-white text-[11px] px-2 py-0.5 rounded-full font-extrabold animate-pulse">
                    {userOrdersData.liveOrders.length}
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 text-[11px] px-2 py-0.5 rounded-full font-medium">
                    0
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveOrderTab('PAST')}
                className={`py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeOrderTab === 'PAST'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                <span>Past Orders</span>
                <span className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-full font-bold">
                  {userOrdersData.pastOrders.length}
                </span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {ordersLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin w-8 h-8 text-emerald-600" />
                  <p className="text-sm font-medium">Loading user orders...</p>
                </div>
              ) : (
                (() => {
                  const ordersList = activeOrderTab === 'LIVE' ? userOrdersData.liveOrders : userOrdersData.pastOrders;

                  if (ordersList.length === 0) {
                    return (
                      <div className="text-center py-14 px-4 bg-gray-50/70 rounded-2xl border border-gray-100">
                        <UtensilsCrossed size={32} className="mx-auto text-gray-300 mb-2" />
                        <h4 className="font-bold text-gray-800 text-base mb-1">
                          {activeOrderTab === 'LIVE' ? 'No Live Orders' : 'No Past Orders Found'}
                        </h4>
                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                          {activeOrderTab === 'LIVE'
                            ? 'This user does not currently have any active orders in prep or pending acceptance.'
                            : 'This user has no completed, delivered, or settled past orders.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {ordersList.map((order, idx) => {
                        const badge = getStatusBadge(order.status);
                        const isLive = activeOrderTab === 'LIVE';

                        return (
                          <div
                            key={order._id || order.id || idx}
                            className="bg-white rounded-2xl border border-gray-200/90 p-4.5 shadow-xs hover:shadow-md transition-shadow"
                          >
                            {/* Order Header */}
                            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-gray-900 text-sm">
                                    {order.orderNumber ? `#${order.orderNumber}` : `#${String(order._id || order.id).substring(0, 8)}`}
                                  </span>
                                  {order.restaurantName && (
                                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                      {order.restaurantName}
                                    </span>
                                  )}
                                  {order.tableNumber && (
                                    <span className="text-xs text-gray-500 font-medium">
                                      Table {order.tableNumber}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                                </p>
                              </div>

                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} ${isLive ? 'animate-pulse' : ''}`}></span>
                                {badge.label}
                              </span>
                            </div>

                            {/* Items List */}
                            <div className="space-y-1.5 text-xs text-gray-700 mb-3 bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                              {(order.items || []).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between items-center">
                                  <span className="font-medium text-gray-800">
                                    <span className="font-extrabold text-emerald-700 mr-1.5">{item.quantity}×</span>
                                    {item.itemName || item.name}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    ₹{item.subtotal || item.price * (item.quantity || 1)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Total & Summary */}
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-gray-500 font-medium">
                                Payment: <span className="font-bold text-gray-800 uppercase">{order.paymentStatus || 'PENDING'}</span>
                              </span>
                              <div className="text-right">
                                <span className="text-gray-400 text-[11px] mr-1.5">Total Amount:</span>
                                <span className="font-black text-gray-900 text-sm">
                                  ₹{order.total || order.totalAmount || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50/80 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
              <span>Total orders cataloged: <strong>{userOrdersData.totalOrders}</strong></span>
              <button
                onClick={() => setSelectedUserForOrders(null)}
                className="px-4 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
