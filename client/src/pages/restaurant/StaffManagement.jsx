import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Check, Search, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useSocketEvents } from '../../lib/socket';
import { toast, showConfirm } from '../../context/DialogContext';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [tables, setTables] = useState([]);
  const [planLimits, setPlanLimits] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'RESTAURANT_STAFF',
    phone: '',
    isActive: true,
    assignedTables: []
  });

  useEffect(() => {
    fetchStaff();
    fetchTables();
    fetchSubscriptionLimits();
  }, []);

  const fetchSubscriptionLimits = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/subscription`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success && data.data?.limits) {
        setPlanLimits(data.data.limits);
      }
    } catch (e) {
      // silent fallback
    }
  };

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

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/staff`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setStaffList(data.data.staff);
        if (data.data.limits) setPlanLimits(data.data.limits);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setTables(data.data.tables);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Realtime: reflect staff changes made from another admin session/tab.
  useSocketEvents({
    staff_updated: () => {
      fetchStaff();
      fetchTables();
    },
  });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const nonOwnerStaffCount = staffList.filter(s => s.role !== 'RESTAURANT_OWNER' && s.userType !== 'ADMIN').length;
  const maxStaffAccounts = planLimits?.maxStaffAccounts ?? planLimits?.maxStaff ?? null;
  const isStaffLimitReached = maxStaffAccounts !== null && maxStaffAccounts !== undefined && nonOwnerStaffCount >= maxStaffAccounts;

  const openAddModal = () => {
    if (isStaffLimitReached) {
      toast.warning('Your staff accounts limit reached. Please contact admin.');
      return;
    }
    setEditingId(null);
    setFormData({ name: '', email: '', password: '', role: 'RESTAURANT_STAFF', phone: '', isActive: true, assignedTables: [] });
    setShowModal(true);
    setShowPassword(false);
  };

  const openEditModal = (staff) => {
    setEditingId(staff._id);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: '', // Leave blank unless changing
      role: staff.role,
      phone: staff.phone || '',
      isActive: staff.isActive,
      assignedTables: staff.assignedTables ? staff.assignedTables.map(t => typeof t === 'string' ? t : t._id) : []
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleTableToggle = (tableId) => {
    setFormData(prev => {
      const isSelected = prev.assignedTables.includes(tableId);
      if (isSelected) {
        return { ...prev, assignedTables: prev.assignedTables.filter(id => id !== tableId) };
      } else {
        return { ...prev, assignedTables: [...prev.assignedTables, tableId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId && isStaffLimitReached) {
      toast.warning('Your staff accounts limit reached. Please contact admin.');
      return;
    }
    try {
      const url = editingId 
        ? `${import.meta.env.VITE_API_URL}/restaurant/staff/${editingId}`
        : `${import.meta.env.VITE_API_URL}/restaurant/staff`;
      
      const method = editingId ? 'PUT' : 'POST';

      const payload = { ...formData };
      if (editingId && !payload.password) delete payload.password; // Don't send empty password on edit

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchStaff();
        toast.success(editingId ? 'Staff member updated successfully!' : 'Staff member created successfully!');
      } else {
        toast.error(data.message || 'Error saving staff');
      }
    } catch (err) {
      toast.error('Network error saving staff');
    }
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm({
      title: 'Delete Staff Member',
      message: 'Are you sure you want to delete this staff member? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/staff/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
        toast.success('Staff member deleted successfully');
      } else {
        toast.error(data.message || 'Error deleting staff member');
      }
    } catch (err) {
      toast.error('Network error deleting staff member');
    }
  };

  const roleColors = {
    RESTAURANT_OWNER: 'bg-purple-100 text-purple-700',
    RESTAURANT_STAFF: 'bg-blue-100 text-blue-700',
    KITCHEN_STAFF: 'bg-green-100 text-green-700'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px] relative">
      <div className="p-4 sm:p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 rounded-t-xl">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Staff Management</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage waiters, kitchen staff, and roles</p>
        </div>
        {isStaffLimitReached ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>Your staff accounts limit reached contact admin</span>
          </div>
        ) : (
          <button onClick={openAddModal} className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
            <Plus size={20} /> Add Staff
          </button>
        )}
      </div>

      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-sm">
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Email & Phone</th>
              <th className="p-4 font-semibold">Role</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : staffList.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-gray-500">No staff found. Add one above.</td></tr>
            ) : (
              staffList.map((staff) => (
                <tr key={staff._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-800">{staff.name}</td>
                  <td className="p-4">
                    <div className="text-gray-800">{staff.email}</div>
                    <div className="text-sm text-gray-500">{staff.phone || 'N/A'}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${roleColors[staff.role] || 'bg-gray-100 text-gray-600'}`}>
                      {staff.role.replace('_', ' ')}
                    </span>
                    {staff.role === 'RESTAURANT_STAFF' && staff.assignedTables && staff.assignedTables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {staff.assignedTables.map(t => (
                          <span key={t._id || t} className="bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">
                            Table {t.tableNumber || t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {staff.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(staff)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                        <Edit size={18} />
                      </button>
                      {staff.role !== 'RESTAURANT_OWNER' && (
                        <button onClick={() => handleDelete(staff._id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">{editingId ? 'Edit Staff' : 'Add Staff'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form className="p-4 sm:p-6 space-y-4 overflow-y-auto" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email (for login)</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
                  <select name="role" value={formData.role} onChange={handleChange} required disabled={formData.role === 'RESTAURANT_OWNER'} className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-500">
                    <option value="RESTAURANT_STAFF">Waiter</option>
                    <option value="KITCHEN_STAFF">Kitchen Staff</option>
                    {formData.role === 'RESTAURANT_OWNER' && <option value="RESTAURANT_OWNER">Owner</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone (Optional)</label>
                  <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{editingId ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" 
                    value={formData.password} 
                    onChange={handleChange} 
                    required={!editingId} 
                    className="w-full p-2.5 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {formData.role === 'RESTAURANT_STAFF' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Assign Tables</label>
                  <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tables.length === 0 ? (
                      <div className="col-span-full text-sm text-gray-500 text-center py-2">No tables found. Create tables first.</div>
                    ) : (
                      tables.map(table => (
                        <label key={table._id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-200 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={formData.assignedTables.includes(table._id)}
                            onChange={() => handleTableToggle(table._id)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500 border-gray-300"
                          />
                          <span className="text-sm font-medium text-gray-700">Table {table.tableNumber}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleChange} className="w-4 h-4 text-green-600 rounded focus:ring-green-500" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">Account is Active</label>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold shadow-md shadow-green-600/20 transition-all">{editingId ? 'Save Changes' : 'Add Staff'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
