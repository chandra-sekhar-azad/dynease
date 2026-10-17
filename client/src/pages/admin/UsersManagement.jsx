import React, { useState, useEffect } from 'react';
import { 
  Users, Loader2, Eye, Clock, CheckCircle2, 
  Flame, Sparkles, AlertCircle, Search, 
  Store, UtensilsCrossed, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { authFetch } from '../../utils/api';

export default function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
            View registered platform users, customers, and staff across all restaurants.
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
                </tr>
              ))}
              
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-gray-400">
                    <UtensilsCrossed size={36} className="mx-auto text-gray-300 mb-2" />
                    <p className="font-medium">No users found matching "{searchQuery}"</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
