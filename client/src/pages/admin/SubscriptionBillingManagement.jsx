import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Search, Calendar, Clock, AlertTriangle, CheckCircle, 
  RefreshCw, Edit3, Plus, ArrowUpRight, ShieldAlert, Sparkles, X, 
  Send, ExternalLink, ChevronRight, Check, AlertCircle, Filter, Layers,
  CheckCircle2, Users, Store, DollarSign
} from 'lucide-react';
import { authFetch } from '../../utils/api';
import { toast, showConfirm } from '../../context/DialogContext';

export default function SubscriptionBillingManagement() {
  const [restaurants, setRestaurants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [onlyExpiringSoon, setOnlyExpiringSoon] = useState(false);
  const [activeTab, setActiveTab] = useState('subscriptions'); // 'subscriptions' | 'plans'

  // Edit / Manage Plan Modal State
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editDaysRemaining, setEditDaysRemaining] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editPlan, setEditPlan] = useState('STARTER');
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
        authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants`),
        authFetch(`${import.meta.env.VITE_API_URL}/admin/plans`)
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
    const days = restaurant.daysRemaining !== undefined ? restaurant.daysRemaining : 0;
    setEditDaysRemaining(days);
    
    // Format YYYY-MM-DD for date input
    if (restaurant.subscriptionEndDate) {
      const d = new Date(restaurant.subscriptionEndDate);
      setEditEndDate(d.toISOString().split('T')[0]);
    } else {
      const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      setEditEndDate(d.toISOString().split('T')[0]);
    }

    setEditPlan(restaurant.selectedPlan || 'STARTER');
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
        note: editNote || `Admin updated plan to ${editPlan} (${editDaysRemaining} days remaining)`
      };

      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${editingRestaurant._id}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setEditingRestaurant(null);
        await fetchData();
        toast.success('Plan and days remaining updated successfully!');
      } else {
        toast.error(data.message || 'Failed to update plan details');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error while updating plan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectAddDays = async (restaurant, daysToAdd) => {
    const current = restaurant.daysRemaining || 0;
    const newDays = current + daysToAdd;
    const ok = await showConfirm({
      title: 'Extend Subscription',
      message: `Extend ${restaurant.name} subscription by +${daysToAdd} days (total ${newDays} days remaining)?`,
      confirmText: 'Extend',
      type: 'info'
    });
    if (!ok) return;

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${restaurant._id}/billing`, {
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
        toast.success(`Subscription extended by +${daysToAdd} days`);
      } else {
        toast.error(data.message || 'Error updating billing');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to extend billing');
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

  const planOptions = [
    { id: 'STARTER', name: 'Starter', price: '₹999/mo', desc: 'Up to 5 tables • 3 staff' },
    { id: 'GROWTH', name: 'Growth', price: '₹1,999/mo', desc: 'Up to 20 tables • 10 staff', popular: true },
    { id: 'BUSINESS', name: 'Business', price: '₹3,499/mo', desc: 'Up to 40 tables • 30 staff • Multi-outlet' },
    { id: 'PRO', name: 'Pro / Custom', price: 'Enterprise', desc: 'Unlimited tables & staff' },
    { id: 'FREE', name: 'Free Trial', price: '₹0', desc: '14-day evaluation trial' }
  ];

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
              Plan Management
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Monitor restaurant subscription plans, track billing expiration, adjust days, and manage plan tiers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Tabs */}
          <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'subscriptions'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Restaurant Subscriptions
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'plans'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Platform Plan Tiers
            </button>
          </div>

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

      {activeTab === 'plans' ? (
        /* ── Platform Plans Overview Tab ── */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
            <h2 className="text-lg font-bold text-gray-900 font-serif mb-1">Dynease Official Plan Tiers</h2>
            <p className="text-xs text-gray-500 mb-6">These are the subscription plans available across the platform for restaurants.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {plans.map((p) => (
                <div key={p.planId} className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                  p.isPopular ? 'border-emerald-400 bg-emerald-50/20 shadow-md ring-2 ring-emerald-400/20' : 'border-gray-200 bg-white shadow-xs'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {p.name}
                      </span>
                      {p.badge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700">
                          {p.badge}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 mb-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-gray-900">
                          {p.monthlyDisplayPrice === 'Custom' ? 'Custom' : `₹${p.monthlyDisplayPrice}`}
                        </span>
                        {p.monthlyDisplayPrice !== 'Custom' && <span className="text-xs text-gray-500 font-medium">/ month</span>}
                      </div>
                      {p.yearlyDisplayPrice !== 'Custom' && (
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          ₹{p.yearlyDisplayPrice}/yr (Save {p.discountPercent}%)
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mb-4">{p.tagline}</p>

                    <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Store size={14} className="text-emerald-600 shrink-0" />
                        <span>{p.limits?.maxLocations ? `Up to ${p.limits.maxLocations} Locations` : 'Unlimited Locations'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Layers size={14} className="text-emerald-600 shrink-0" />
                        <span>{p.limits?.maxTables ? `Up to ${p.limits.maxTables} Tables` : 'Unlimited Tables'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Users size={14} className="text-emerald-600 shrink-0" />
                        <span>{p.limits?.maxStaffAccounts ? `Up to ${p.limits.maxStaffAccounts} Staff` : 'Unlimited Staff'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock size={14} className="text-emerald-600 shrink-0" />
                        <span>{p.limits?.orderHistoryDays ? `${p.limits.orderHistoryDays} Days Order History` : 'Lifetime History'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSelectedPlanFilter(p.planId);
                        setActiveTab('subscriptions');
                      }}
                      className="w-full py-2 px-3 text-xs font-bold rounded-xl bg-gray-100 hover:bg-emerald-600 hover:text-white text-gray-700 transition-colors text-center cursor-pointer"
                    >
                      Filter Restaurants by {p.name}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Subscriptions & Days Management Tab ── */
        <div className="space-y-6">
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
                <option value="FREE">FREE Trial</option>
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

              {/* Expiring Soon Toggle */}
              <button
                onClick={() => setOnlyExpiringSoon(!onlyExpiringSoon)}
                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  onlyExpiringSoon
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Clock size={13} />
                <span>Expiring Soon (≤7d)</span>
              </button>
            </div>
          </div>

          {/* ── Restaurants & Plans Table ── */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Restaurant</th>
                    <th className="py-3.5 px-4">Owner & Contact</th>
                    <th className="py-3.5 px-4">Plan</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Billing Period</th>
                    <th className="py-3.5 px-4">Days Remaining</th>
                    <th className="py-3.5 px-4 text-right">Plan Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400 font-medium">
                        <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto mb-2" />
                        Loading restaurant plans & subscriptions...
                      </td>
                    </tr>
                  ) : filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400 font-medium">
                        <CreditCard size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-gray-700 font-bold mb-1">No restaurants matching criteria</p>
                        <p className="text-xs text-gray-400">Try adjusting your search or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRestaurants.map((res) => {
                      const days = res.daysRemaining !== undefined ? res.daysRemaining : 0;
                      return (
                        <tr key={res._id} className="hover:bg-gray-50/70 transition-colors">
                          {/* Restaurant details */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-gray-900 text-sm">{res.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-gray-400 text-[11px]">
                              <span>{res.subdomain || res.slug}.dynease.in</span>
                              <a
                                href={`https://${res.subdomain || res.slug}.dynease.in`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-400 hover:text-emerald-600"
                                title="Open tenant storefront"
                              >
                                <ExternalLink size={11} />
                              </a>
                            </div>
                          </td>

                          {/* Owner & Contact */}
                          <td className="py-4 px-4">
                            <div className="font-semibold text-gray-800">{res.ownerId?.name || res.ownerName || 'N/A'}</div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {res.ownerId?.phone || res.ownerPhone || 'No phone'}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {res.ownerId?.email || res.ownerEmail || ''}
                            </div>
                          </td>

                          {/* Selected Plan */}
                          <td className="py-4 px-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wide ${
                                res.selectedPlan === 'PRO' || res.selectedPlan === 'CUSTOM'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : res.selectedPlan === 'BUSINESS'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : res.selectedPlan === 'GROWTH'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
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

                          {/* Plan Management Actions */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Manage Plan Button */}
                              <button
                                onClick={() => openEditModal(res)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer group"
                                title="Manage plan, subscription status, and billing days"
                              >
                                <CreditCard size={14} className="group-hover:scale-110 transition-transform text-emerald-100" />
                                <span>Manage Plan</span>
                                <ChevronRight size={13} className="text-emerald-200" />
                              </button>

                              {/* Quick 1-click +30 days */}
                              <button
                                onClick={() => handleDirectAddDays(res, 30)}
                                title="Quickly add +30 days to billing"
                                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200/80 cursor-pointer"
                              >
                                +30d
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
        </div>
      )}

      {/* ── Comprehensive "Manage Plan & Days" Modal ── */}
      {editingRestaurant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                  <CreditCard size={22} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 font-serif">
                    Manage Plan & Days
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editingRestaurant.name} • <span className="font-mono text-gray-600">{editingRestaurant.subdomain || editingRestaurant.slug}.dynease.in</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingRestaurant(null)}
                className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-200/60 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveBilling} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Current Overview Snapshot */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Current Active Subscription
                  </span>
                  <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                    {editingRestaurant.selectedPlan || 'STARTER'} Plan • {editingRestaurant.daysRemaining || 0} days remaining
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Expiry Date: {formatDate(editingRestaurant.subscriptionEndDate)}
                  </div>
                </div>
                <div className="text-right">
                  {getDaysBadge(editingRestaurant.daysRemaining || 0, editingRestaurant.subscriptionStatus)}
                </div>
              </div>

              {/* Step 1: Select Plan Tier */}
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                  1. Select Subscription Plan Tier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {planOptions.map((opt) => {
                    const isSelected = editPlan === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setEditPlan(opt.id)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-400/30'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900">{opt.name}</span>
                          <span className="text-xs font-extrabold text-emerald-700">{opt.price}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Manage Days Remaining */}
              <div className="space-y-3 pt-1 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    2. Manage Subscription Days Remaining
                  </label>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
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
                    placeholder="Enter days..."
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    days remaining
                  </span>
                </div>

                {/* Quick Addition Chips */}
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 block mb-1.5">
                    Quick Preset Adjustments:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(7)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      +7d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(14)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      +14d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(30)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      +30d (1 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(60)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      +60d (2 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(90)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      +90d (3 Mo)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddDays(365)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors cursor-pointer"
                    >
                      +365d (1 Yr)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDaysChange(0)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      Expire Now (0d)
                    </button>
                  </div>
                </div>

                {/* Exact Date Picker */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Or choose specific expiration date:
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Dynamic Live Result Calculation */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Calculated Outcome:</span> Plan will be set to <span className="font-extrabold underline">{editPlan}</span>. 
                  Expiry will be on <span className="font-extrabold">{formatDate(editEndDate)}</span> ({editDaysRemaining} days remaining). 
                  Status will be <span className="font-extrabold">{editStatus}</span>.
                </div>
              </div>

              {/* Step 3: Subscription Status & Audit Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Subscription Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE (Paid Access)</option>
                    <option value="TRIAL">TRIAL (Free Trial)</option>
                    <option value="EXPIRED">EXPIRED (Blocked)</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Audit Note / Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="e.g. Paid offline UPI, 30 days extension"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRestaurant(null)}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Save & Update Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
