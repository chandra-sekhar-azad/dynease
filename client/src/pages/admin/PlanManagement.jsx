import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Plus, Edit2, Trash2, CheckCircle2, XCircle, 
  AlertTriangle, RefreshCw, Layers, Users, Store, Clock, 
  Check, X, Search, ShieldAlert, ArrowUpRight, ChevronRight,
  Filter, Sparkles
} from 'lucide-react';
import { authFetch } from '../../utils/api';

export default function PlanManagement() {
  const [plans, setPlans] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [planRequests, setPlanRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'assignments' | 'requests'

  // Plan Create / Edit Modal State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    tagline: '',
    monthlyDisplayPrice: '',
    yearlyDisplayPrice: '',
    planStatus: 'ACTIVE',
    isPopular: false,
    badge: '',
    maxTables: 10,
    maxMenuItems: 50,
    maxStaffAccounts: 3,
    maxLocations: 1,
    orderHistoryDays: 30,
    qrOrdering: true,
    liveOrders: true,
    customerReviews: true,
    waiterAssignment: true,
    salesAnalytics: 'basic',
    supportLevel: 'standard'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject Request Modal State
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [plansRes, resRes, reqRes] = await Promise.all([
        authFetch(`${import.meta.env.VITE_API_URL}/admin/plans`),
        authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants`),
        authFetch(`${import.meta.env.VITE_API_URL}/admin/plan-requests`)
      ]);

      const plansData = await plansRes.json();
      const resData = await resRes.json();
      const reqData = await reqRes.json();

      if (plansData.success) {
        setPlans(plansData.data.plans || []);
      }
      if (resData.success) {
        setRestaurants(resData.data.restaurants || []);
      }
      if (reqData.success) {
        setPlanRequests(reqData.data.planRequests || []);
      }
    } catch (err) {
      console.error('[PlanManagement] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      tagline: '',
      monthlyDisplayPrice: '',
      yearlyDisplayPrice: '',
      planStatus: 'ACTIVE',
      isPopular: false,
      badge: '',
      maxTables: 10,
      maxMenuItems: 50,
      maxStaffAccounts: 3,
      maxLocations: 1,
      orderHistoryDays: 30,
      qrOrdering: true,
      liveOrders: true,
      customerReviews: true,
      waiterAssignment: true,
      salesAnalytics: 'basic',
      supportLevel: 'standard'
    });
    setShowPlanModal(true);
  };

  const handleOpenEditModal = (p) => {
    setEditingPlan(p);
    const cfg = p.configuration || {};
    const limits = cfg.limits || {};
    const features = cfg.features || {};

    setPlanForm({
      name: p.name,
      tagline: cfg.tagline || '',
      monthlyDisplayPrice: cfg.monthlyDisplayPrice ?? '',
      yearlyDisplayPrice: cfg.yearlyDisplayPrice ?? '',
      planStatus: p.plan_status || 'ACTIVE',
      isPopular: cfg.isPopular || false,
      badge: cfg.badge || '',
      maxTables: limits.maxTables ?? 10,
      maxMenuItems: limits.maxMenuItems ?? 50,
      maxStaffAccounts: limits.maxStaffAccounts ?? 3,
      maxLocations: limits.maxLocations ?? 1,
      orderHistoryDays: limits.orderHistoryDays ?? 30,
      qrOrdering: features.qrOrdering ?? true,
      liveOrders: features.liveOrders ?? true,
      customerReviews: features.customerReviews ?? true,
      waiterAssignment: features.waiterAssignment ?? true,
      salesAnalytics: features.salesAnalytics || 'basic',
      supportLevel: features.supportLevel || 'standard'
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      alert('Plan name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const configuration = {
        planId: planForm.name.toUpperCase().replace(/\s+/g, '_'),
        name: planForm.name.trim(),
        tagline: planForm.tagline.trim(),
        monthlyDisplayPrice: planForm.monthlyDisplayPrice !== '' ? Number(planForm.monthlyDisplayPrice) : null,
        yearlyDisplayPrice: planForm.yearlyDisplayPrice !== '' ? Number(planForm.yearlyDisplayPrice) : null,
        monthlyPricePaise: planForm.monthlyDisplayPrice !== '' ? Number(planForm.monthlyDisplayPrice) * 100 : null,
        yearlyPricePaise: planForm.yearlyDisplayPrice !== '' ? Number(planForm.yearlyDisplayPrice) * 100 : null,
        currency: 'INR',
        currencySymbol: '₹',
        isPopular: Boolean(planForm.isPopular),
        badge: planForm.badge.trim() || null,
        limits: {
          maxTables: Number(planForm.maxTables),
          maxMenuItems: Number(planForm.maxMenuItems),
          maxStaffAccounts: Number(planForm.maxStaffAccounts),
          maxLocations: Number(planForm.maxLocations),
          orderHistoryDays: Number(planForm.orderHistoryDays)
        },
        features: {
          qrOrdering: Boolean(planForm.qrOrdering),
          liveOrders: Boolean(planForm.liveOrders),
          customerReviews: Boolean(planForm.customerReviews),
          waiterAssignment: Boolean(planForm.waiterAssignment),
          salesAnalytics: planForm.salesAnalytics,
          supportLevel: planForm.supportLevel
        },
        displayFeatures: [
          `${planForm.maxLocations} Location(s)`,
          `Up to ${planForm.maxTables} Tables`,
          `Up to ${planForm.maxMenuItems} Menu Items`,
          `Up to ${planForm.maxStaffAccounts} Staff Accounts`,
          `${planForm.orderHistoryDays} Days Order History`,
          `${planForm.salesAnalytics.toUpperCase()} Sales Analytics`,
          `${planForm.supportLevel.toUpperCase()} Support`
        ]
      };

      const payload = {
        name: planForm.name.trim(),
        plan_status: planForm.planStatus,
        configuration
      };

      const url = editingPlan 
        ? `${import.meta.env.VITE_API_URL}/admin/plans/${editingPlan.id}`
        : `${import.meta.env.VITE_API_URL}/admin/plans`;

      const method = editingPlan ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setShowPlanModal(false);
        fetchData();
      } else {
        alert(data.message || 'Failed to save plan');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePlanStatus = async (plan) => {
    const newStatus = plan.plan_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plans/${plan.id}`, {
        method: 'PUT',
        body: JSON.stringify({ plan_status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message || 'Failed to update plan status');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plans/${planId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message || 'Cannot delete plan');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  const handleApproveRequest = async (requestId) => {
    setActionLoading(requestId);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plan-requests/${requestId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message || 'Failed to approve request');
      }
    } catch (err) {
      console.error(err);
      alert('Error approving request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (e) => {
    e.preventDefault();
    if (!rejectingRequest) return;

    setActionLoading(rejectingRequest.id);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plan-requests/${rejectingRequest.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (data.success) {
        setRejectingRequest(null);
        setRejectReason('');
        fetchData();
      } else {
        alert(data.message || 'Failed to reject request');
      }
    } catch (err) {
      console.error(err);
      alert('Error rejecting request');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingRequestsCount = planRequests.filter(r => r.status === 'PENDING').length;

  // Filtered restaurants for assignments tab
  const filteredRestaurants = restaurants.filter(r => {
    const matchesSearch = 
      (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.domain || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = selectedPlanFilter === 'ALL' || r.plan_id === selectedPlanFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900 tracking-tight flex items-center gap-2">
            <CreditCard className="text-emerald-600" size={26} />
            Plan & Subscription Management
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure platform subscription tiers, review plan upgrade requests, and monitor restaurant allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition shadow-xs cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus size={16} />
            Create New Plan
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 transition relative cursor-pointer ${
            activeTab === 'plans' 
              ? 'text-emerald-600 border-b-2 border-emerald-600' 
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Plan Tiers ({plans.length})
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`pb-3 transition relative cursor-pointer ${
            activeTab === 'assignments' 
              ? 'text-emerald-600 border-b-2 border-emerald-600' 
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Assigned Restaurants ({restaurants.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 transition relative flex items-center gap-2 cursor-pointer ${
            activeTab === 'requests' 
              ? 'text-emerald-600 border-b-2 border-emerald-600' 
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Plan Change Requests
          {pendingRequestsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: PLANS ── */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((p) => {
              const cfg = p.configuration || {};
              const limits = cfg.limits || {};
              const features = cfg.features || {};
              const assignedCount = restaurants.filter(r => r.plan_id === p.id).length;

              return (
                <div 
                  key={p.id} 
                  className={`bg-white rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-all relative ${
                    p.plan_status === 'ACTIVE' ? 'border-gray-200 hover:border-emerald-300' : 'border-gray-200 bg-gray-50/50 opacity-75'
                  }`}
                >
                  <div>
                    {/* Header: Name, Badge, Status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {p.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.plan_status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.plan_status}
                      </span>
                    </div>

                    {/* Price */}
                    <div className="my-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-gray-900">
                          {cfg.monthlyDisplayPrice ? `₹${cfg.monthlyDisplayPrice}` : 'Custom'}
                        </span>
                        {cfg.monthlyDisplayPrice && <span className="text-xs text-gray-500">/ month</span>}
                      </div>
                      {cfg.yearlyDisplayPrice && (
                        <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                          ₹{cfg.yearlyDisplayPrice} / year
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mb-4 min-h-[32px]">{cfg.tagline || 'Subscription tier configuration'}</p>

                    {/* Limits summary */}
                    <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-emerald-600 shrink-0" />
                        <span>Up to <strong>{limits.maxTables ?? 0}</strong> Tables</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Store size={14} className="text-emerald-600 shrink-0" />
                        <span>Up to <strong>{limits.maxMenuItems ?? 0}</strong> Menu Items</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-emerald-600 shrink-0" />
                        <span>Up to <strong>{limits.maxStaffAccounts ?? 0}</strong> Staff Accounts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-emerald-600 shrink-0" />
                        <span><strong>{limits.orderHistoryDays ?? 30}</strong> Days Order History</span>
                      </div>
                    </div>

                    {/* Features Badges */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                      {features.qrOrdering && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">QR Ordering</span>
                      )}
                      {features.liveOrders && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Live Orders</span>
                      )}
                      {features.waiterAssignment && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Waiter Routing</span>
                      )}
                      {features.customerReviews && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Reviews</span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Assigned Count */}
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-500">
                      {assignedCount} Restaurant{assignedCount !== 1 ? 's' : ''}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTogglePlanStatus(p)}
                        className={`p-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          p.plan_status === 'ACTIVE' 
                            ? 'border-gray-200 text-gray-600 hover:bg-gray-100' 
                            : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                        title={p.plan_status === 'ACTIVE' ? 'Deactivate Plan' : 'Activate Plan'}
                      >
                        {p.plan_status === 'ACTIVE' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 cursor-pointer"
                        title="Edit Plan Configuration"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => handleDeletePlan(p.id)}
                        disabled={assignedCount > 0}
                        className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                          assignedCount > 0 
                            ? 'border-gray-100 text-gray-300 cursor-not-allowed' 
                            : 'border-red-200 text-red-600 hover:bg-red-50'
                        }`}
                        title={assignedCount > 0 ? 'Cannot delete: active restaurants assigned' : 'Delete Plan'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: ASSIGNED RESTAURANTS ── */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search restaurants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedPlanFilter}
                onChange={(e) => setSelectedPlanFilter(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Plans</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Restaurants Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Subdomain</th>
                    <th className="py-3 px-4">Assigned Plan</th>
                    <th className="py-3 px-4">Plan Override</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400 font-medium">
                        No restaurants found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRestaurants.map(r => {
                      const assignedPlan = plans.find(p => p.id === r.plan_id);

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-3.5 px-4 font-semibold text-gray-900">{r.name}</td>
                          <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">{r.domain}.dynease.in</td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                              {assignedPlan ? assignedPlan.name : (r.selectedPlan || 'Starter')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {r.is_plan_overridden ? (
                              <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                Overridden: {r.overriden_plan || 'Custom'}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-medium">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              r.restaurant_status === 'ACTIVE' 
                                ? 'bg-green-100 text-green-700' 
                                : r.restaurant_status === 'PAUSED'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {r.restaurant_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-500">
                            {new Date(r.createdat).toLocaleDateString()}
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

      {/* ── TAB 3: PLAN CHANGE REQUESTS ── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Restaurant Plan Change Requests</h2>
                <p className="text-xs text-gray-500">Review and authorize restaurant requests to upgrade or change subscription plans.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Restaurant</th>
                    <th className="py-3 px-4">Requested Plan</th>
                    <th className="py-3 px-4">Billing Cycle</th>
                    <th className="py-3 px-4">Requested By</th>
                    <th className="py-3 px-4">Request Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {planRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                        No plan change requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    planRequests.map(pr => (
                      <tr key={pr.id} className="hover:bg-gray-50/50 transition">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-900">{pr.restaurantName}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{pr.subdomain}.dynease.in</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                            {pr.planName}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 capitalize font-medium">{pr.billingCycle}</td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-gray-800">{pr.requestedBy?.name || 'Owner'}</p>
                          <p className="text-[11px] text-gray-400">{pr.requestedBy?.email || pr.requestedBy?.phone || '—'}</p>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {new Date(pr.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            pr.status === 'APPROVED'
                              ? 'bg-green-100 text-green-700'
                              : pr.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {pr.status}
                          </span>
                          {pr.rejectionReason && (
                            <p className="text-[10px] text-red-600 mt-1">{pr.rejectionReason}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {pr.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveRequest(pr.id)}
                                disabled={actionLoading === pr.id}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer"
                              >
                                <Check size={12} />
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectingRequest(pr)}
                                disabled={actionLoading === pr.id}
                                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                              >
                                <X size={12} />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT PLAN MODAL ── */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 font-serif">
                {editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create Subscription Plan'}
              </h2>
              <button 
                onClick={() => setShowPlanModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="e.g. Starter, Growth, Enterprise"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={planForm.planStatus}
                    onChange={(e) => setPlanForm({ ...planForm, planStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Tagline / Description</label>
                <input
                  type="text"
                  value={planForm.tagline}
                  onChange={(e) => setPlanForm({ ...planForm, tagline: e.target.value })}
                  placeholder="Short summary of target restaurant type..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Monthly Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={planForm.monthlyDisplayPrice}
                    onChange={(e) => setPlanForm({ ...planForm, monthlyDisplayPrice: e.target.value })}
                    placeholder="999"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Yearly Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={planForm.yearlyDisplayPrice}
                    onChange={(e) => setPlanForm({ ...planForm, yearlyDisplayPrice: e.target.value })}
                    placeholder="9999"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Capacity Limits */}
              <div className="border-t border-gray-100 pt-3">
                <h3 className="font-bold text-gray-800 mb-2">Entitlement & Resource Limits</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max Tables</label>
                    <input
                      type="number"
                      min="1"
                      value={planForm.maxTables}
                      onChange={(e) => setPlanForm({ ...planForm, maxTables: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max Menu Items</label>
                    <input
                      type="number"
                      min="1"
                      value={planForm.maxMenuItems}
                      onChange={(e) => setPlanForm({ ...planForm, maxMenuItems: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max Staff Accounts</label>
                    <input
                      type="number"
                      min="1"
                      value={planForm.maxStaffAccounts}
                      onChange={(e) => setPlanForm({ ...planForm, maxStaffAccounts: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">History Days</label>
                    <input
                      type="number"
                      min="1"
                      value={planForm.orderHistoryDays}
                      onChange={(e) => setPlanForm({ ...planForm, orderHistoryDays: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="border-t border-gray-100 pt-3">
                <h3 className="font-bold text-gray-800 mb-2">Features Included</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.qrOrdering}
                      onChange={(e) => setPlanForm({ ...planForm, qrOrdering: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>QR Ordering</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.liveOrders}
                      onChange={(e) => setPlanForm({ ...planForm, liveOrders: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Live Kitchen Orders</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.customerReviews}
                      onChange={(e) => setPlanForm({ ...planForm, customerReviews: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Google Reviews</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={planForm.waiterAssignment}
                      onChange={(e) => setPlanForm({ ...planForm, waiterAssignment: e.target.checked })}
                      className="rounded text-emerald-600"
                    />
                    <span>Waiter Routing</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REJECT REQUEST MODAL ── */}
      {rejectingRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-2">Reject Plan Change Request</h3>
            <p className="text-xs text-gray-500 mb-4">
              Provide a reason for rejecting the {rejectingRequest.planName} plan request from {rejectingRequest.restaurantName}.
            </p>

            <form onSubmit={handleRejectRequest} className="space-y-4">
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-red-500"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="px-4 py-2 text-xs border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === rejectingRequest.id}
                  className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
