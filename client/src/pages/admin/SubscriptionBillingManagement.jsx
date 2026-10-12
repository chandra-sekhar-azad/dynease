import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Search, Calendar, Clock, AlertTriangle, CheckCircle, 
  RefreshCw, Edit3, Plus, ArrowUpRight, ShieldAlert, Sparkles, X, 
  Send, ExternalLink, ChevronRight, Check, AlertCircle, Filter
} from 'lucide-react';

export default function SubscriptionBillingManagement() {
  const [restaurants, setRestaurants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [onlyExpiringSoon, setOnlyExpiringSoon] = useState(false);

  // Edit Billing Modal State
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editDaysRemaining, setEditDaysRemaining] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editPlan, setEditPlan] = useState('FREE');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resRes, plansRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/admin/restaurants`),
        fetch(`${import.meta.env.VITE_API_URL}/admin/plans`)
      ]);
      const resData = await resRes.json();
      const plansData = await plansRes.json();

      if (resData.success) {
        setRestaurants(resData.data.restaurants || []);
      }
      if (plansData.success) {
        setPlans(plansData.data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch billing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (restaurant) => {
    setEditingRestaurant(restaurant);
    setEditDaysRemaining(restaurant.daysRemaining !== undefined ? restaurant.daysRemaining : 0);
    
    // Format YYYY-MM-DD for date input
    if (restaurant.subscriptionEndDate) {
      const d = new Date(restaurant.subscriptionEndDate);
      setEditEndDate(d.toISOString().split('T')[0]);
    } else {
      setEditEndDate('');
    }

    setEditPlan(restaurant.selectedPlan || 'FREE');
    setEditStatus(restaurant.subscriptionStatus || 'ACTIVE');
    setEditNote('');
  };

  const handleDaysChange = (newDays) => {
    const days = Math.max(0, parseInt(newDays, 10) || 0);
    setEditDaysRemaining(days);
    const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    setEditEndDate(targetDate.toISOString().split('T')[0]);
    if (days > 0 && editStatus === 'EXPIRED') {
      setEditStatus(editPlan === 'FREE' ? 'TRIAL' : 'ACTIVE');
    } else if (days === 0) {
      setEditStatus('EXPIRED');
    }
  };

  const handleDateChange = (dateStr) => {
    setEditEndDate(dateStr);
    if (dateStr) {
      const targetDate = new Date(dateStr);
      const diff = targetDate - new Date();
      const calculatedDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      setEditDaysRemaining(calculatedDays);
      if (calculatedDays > 0 && editStatus === 'EXPIRED') {
        setEditStatus(editPlan === 'FREE' ? 'TRIAL' : 'ACTIVE');
      } else if (calculatedDays === 0) {
        setEditStatus('EXPIRED');
      }
    }
  };

  const handleQuickAddDays = (additionalDays) => {
    if (additionalDays === 0) {
      handleDaysChange(0);
      return;
    }
    const current = parseInt(editDaysRemaining, 10) || 0;
    handleDaysChange(current + additionalDays);
  };

  const handleSaveBilling = async (e) => {
    e.preventDefault();
    if (!editingRestaurant) return;

    setIsSaving(true);
    try {
      const payload = {
        daysRemaining: parseInt(editDaysRemaining, 10),
        subscriptionEndDate: editEndDate ? new Date(editEndDate).toISOString() : undefined,
        selectedPlan: editPlan,
        subscriptionStatus: editStatus,
        note: editNote || `Manual update: ${editDaysRemaining} days remaining`
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${editingRestaurant._id}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setEditingRestaurant(null);
        await fetchData();
        alert('Billing and days remaining updated successfully!');
      } else {
        alert(data.message || 'Failed to update billing details');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while updating billing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectAddDays = async (restaurant, daysToAdd) => {
    const current = restaurant.daysRemaining || 0;
    const newDays = current + daysToAdd;
    if (!window.confirm(`Extend ${restaurant.name} subscription by +${daysToAdd} days (total ${newDays} days remaining)?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${restaurant._id}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysRemaining: newDays,
          note: `Quick extension +${daysToAdd} days`
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message || 'Error updating billing');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to extend billing');
    }
  };

  // Filter calculations
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = 
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.subdomain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.ownerId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.ownerId?.phone?.includes(searchTerm) ||
      r.ownerId?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPlan = selectedPlanFilter === 'ALL' || r.selectedPlan === selectedPlanFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || r.subscriptionStatus === selectedStatusFilter;
    const matchesExpiring = !onlyExpiringSoon || (r.daysRemaining <= 7 && r.daysRemaining > 0);

    return matchesSearch && matchesPlan && matchesStatus && matchesExpiring;
  });

  // KPI Metrics
  const totalCount = restaurants.length;
  const activeCount = restaurants.filter(r => r.subscriptionStatus === 'ACTIVE').length;
  const trialCount = restaurants.filter(r => r.subscriptionStatus === 'TRIAL').length;
  const expiredCount = restaurants.filter(r => r.subscriptionStatus === 'EXPIRED' || (r.daysRemaining === 0 && r.subscriptionEndDate)).length;
  const expiringSoonCount = restaurants.filter(r => r.daysRemaining <= 7 && r.daysRemaining > 0).length;
  const pendingRequestsCount = restaurants.filter(r => r.renewalRequest?.status === 'PENDING').length;

  const formatDate = (dateVal) => {
    if (!dateVal) return 'Not set';
    try {
      return new Date(dateVal).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getDaysBadge = (days, status) => {
    if (status === 'EXPIRED' || days === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
          <AlertCircle size={12} />
          <span>Expired (0d)</span>
        </span>
      );
    }
    if (days <= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-200 animate-pulse">
          <Clock size={12} />
          <span>{days} {days === 1 ? 'day' : 'days'} left</span>
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          <Clock size={12} />
          <span>{days} days left</span>
        </span>
      );
    }
    if (days <= 14) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Calendar size={12} />
          <span>{days} days left</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle size={12} />
        <span>{days} days left</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CreditCard size={22} />
            </span>
            <h1 className="text-2xl font-bold font-serif text-gray-900 tracking-tight">
              Subscription & Billing
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Monitor restaurant subscription plans, track billing expiration, and edit remaining days in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Metrics Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{totalCount}</p>
          <span className="text-[11px] text-gray-500 font-medium">All registered</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Active Paid</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{activeCount}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Full access</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 bg-blue-50/20 shadow-xs">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Trials</p>
          <p className="text-2xl font-extrabold text-blue-700 mt-1">{trialCount}</p>
          <span className="text-[11px] text-blue-600 font-medium">14-day free trial</span>
        </div>

        <div 
          onClick={() => setOnlyExpiringSoon(!onlyExpiringSoon)}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
            onlyExpiringSoon 
              ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400' 
              : 'bg-white border-amber-100 hover:border-amber-200 bg-amber-50/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Expiring Soon</p>
            {expiringSoonCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
          </div>
          <p className="text-2xl font-extrabold text-amber-800 mt-1">{expiringSoonCount}</p>
          <span className="text-[11px] text-amber-700 font-medium">≤ 7 days left</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-xs">
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Expired</p>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">{expiredCount}</p>
          <span className="text-[11px] text-rose-600 font-medium">Ordering blocked</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-xs">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Upgrades</p>
          <p className="text-2xl font-extrabold text-purple-700 mt-1">{pendingRequestsCount}</p>
          <span className="text-[11px] text-purple-600 font-medium">Pending approvals</span>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by restaurant name, subdomain, phone or email..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-gray-900"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Plan filter */}
          <select
            value={selectedPlanFilter}
            onChange={(e) => setSelectedPlanFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Plans</option>
            <option value="STARTER">STARTER Plan</option>
            <option value="GROWTH">GROWTH Plan</option>
            <option value="BUSINESS">BUSINESS Plan</option>
            <option value="PRO">PRO Plan</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="TRIAL">TRIAL</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>

          {/* Toggle only expiring soon */}
          <button
            onClick={() => setOnlyExpiringSoon(!onlyExpiringSoon)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              onlyExpiringSoon
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Expiring Soon (≤7d)
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-200/80 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Restaurant</th>
                <th className="py-3.5 px-4">Owner & Contact</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Billing Period</th>
                <th className="py-3.5 px-4">Days Remaining</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-gray-400">
                    <CreditCard size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-gray-600">No restaurants matching criteria</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((res) => {
                  const days = res.daysRemaining !== undefined ? res.daysRemaining : 0;
                  const isExpiring = days <= 7 && days > 0;
                  const isExpired = res.subscriptionStatus === 'EXPIRED' || days === 0;

                  return (
                    <tr key={res._id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Restaurant Info */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-gray-900 text-sm">{res.name}</div>
                        <a
                          href={`https://${res.subdomain || res.slug}.dynease.in`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          <span>{res.subdomain || res.slug}.dynease.in</span>
                          <ExternalLink size={10} />
                        </a>
                      </td>

                      {/* Owner Info */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-800">{res.ownerId?.name || 'Owner'}</div>
                        <div className="text-gray-500 text-[11px]">{res.ownerId?.phone || 'No phone'}</div>
                        <div className="text-gray-400 text-[10px]">{res.ownerId?.email || ''}</div>
                      </td>

                      {/* Plan */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                            res.selectedPlan === 'PRO'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : res.selectedPlan === 'BUSINESS'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : res.selectedPlan === 'GROWTH'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {res.selectedPlan || 'STARTER'}
                          </span>
                          {res.renewalRequest?.status === 'PENDING' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                              <AlertTriangle size={10} /> Req: {res.renewalRequest.plan}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase inline-flex items-center gap-1.5 ${
                          res.subscriptionStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : res.subscriptionStatus === 'TRIAL'
                            ? 'bg-blue-100 text-blue-800'
                            : res.subscriptionStatus === 'EXPIRED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            res.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-600' :
                            res.subscriptionStatus === 'TRIAL' ? 'bg-blue-600' :
                            res.subscriptionStatus === 'EXPIRED' ? 'bg-rose-600' : 'bg-gray-400'
                          }`} />
                          {res.subscriptionStatus || 'UNKNOWN'}
                        </span>
                      </td>

                      {/* Billing Dates */}
                      <td className="py-4 px-4">
                        <div className="text-[11px] text-gray-700 font-medium">
                          {formatDate(res.subscriptionStartDate)} – {formatDate(res.subscriptionEndDate)}
                        </div>
                        {res.subscriptionEndDate && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            Expires: {new Date(res.subscriptionEndDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Days Remaining */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {getDaysBadge(days, res.subscriptionStatus)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick 1-click +30 days */}
                          <button
                            onClick={() => handleDirectAddDays(res, 30)}
                            title="Quickly add 30 days to billing"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200/80 cursor-pointer"
                          >
                            +30d
                          </button>

                          {/* Full Edit Billing Modal */}
                          <button
                            onClick={() => openEditModal(res)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-900 hover:bg-black text-white shadow-xs transition-all cursor-pointer"
                            title="Edit billing days & subscription plan"
                          >
                            <Edit3 size={13} />
                            <span>Edit Days</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Billing & Days Remaining Modal ── */}
      {editingRestaurant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <CreditCard size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 font-serif">
                    Edit Billing & Subscription
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editingRestaurant.name} ({editingRestaurant.subdomain}.dynease.in)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingRestaurant(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-200/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveBilling} className="p-6 space-y-5">
              {/* Current Overview Badge */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                    Current Plan & Expiry
                  </span>
                  <div className="text-sm font-bold text-emerald-950 mt-0.5">
                    {editingRestaurant.selectedPlan} Plan • {editingRestaurant.daysRemaining} days remaining
                  </div>
                  <div className="text-xs text-emerald-700/80 mt-0.5">
                    End Date: {formatDate(editingRestaurant.subscriptionEndDate)}
                  </div>
                </div>
                <div className="text-right">
                  {getDaysBadge(editingRestaurant.daysRemaining || 0, editingRestaurant.subscriptionStatus)}
                </div>
              </div>

              {/* Days Remaining Input & Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">
                    Billing Days Remaining:
                  </label>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    {editDaysRemaining} {editDaysRemaining === 1 ? 'day' : 'days'}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={editDaysRemaining}
                    onChange={(e) => handleDaysChange(e.target.value)}
                    required
                    className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                    placeholder="Enter number of days..."
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    days
                  </span>
                </div>

                {/* Quick Add Buttons */}
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 block mb-1.5">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(7)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +7d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(14)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +14d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(30)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +30d (1 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(60)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +60d (2 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(90)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +90d (3 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(365)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      +365d (1 Yr)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDaysChange(0)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      Expire Now (0d)
                    </button>
                  </div>
                </div>
              </div>

              {/* Exact Expiration Date Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Or Set Exact Expiration Date:
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Plan and Status Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Plan</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="STARTER">STARTER — ₹999/mo (₹9,990/yr)</option>
                    <option value="GROWTH">GROWTH — ₹1,999/mo (₹19,990/yr)</option>
                    <option value="BUSINESS">BUSINESS — ₹3,499/mo (₹34,990/yr)</option>
                    <option value="PRO">PRO — ₹5,999/mo (₹59,990/yr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE (Paid)</option>
                    <option value="TRIAL">TRIAL (Free)</option>
                    <option value="EXPIRED">EXPIRED (Blocked)</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              {/* Note / Transaction description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Update Note (Optional):
                </label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g. Paid offline via UPI, granted 30 days extension"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Submit / Cancel Actions */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRestaurant(null)}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Save & Update Billing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
