import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Plus, Edit2, Trash2, CheckCircle2, XCircle, 
  AlertTriangle, RefreshCw, Layers, Users, Store, Clock, 
  Check, X, Search, ShieldAlert, ArrowUpRight, ChevronRight,
  Filter, Sparkles, RotateCcw, SlidersHorizontal
} from 'lucide-react';
import { authFetch } from '../../utils/api';
import { useSocketEvents } from '../../lib/socket';
import { toast, showConfirm } from '../../context/DialogContext';

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

  // Override Restaurant Plan Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [selectedRestaurantForOverride, setSelectedRestaurantForOverride] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    planId: '',
    selectedPlan: '',
    isPlanOverridden: true,
    overriddenPlan: '',
    note: ''
  });
  const [isSavingOverride, setIsSavingOverride] = useState(false);

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

  // Realtime updates
  useSocketEvents({
    restaurant_registered: () => fetchData(),
    restaurant_updated: () => fetchData(),
    plan_request: () => fetchData(),
    plan_request_updated: () => fetchData(),
  });

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

  // Plan Override Handlers
  const handleOpenOverrideModal = (restaurant) => {
    setSelectedRestaurantForOverride(restaurant);
    const currentPlanId = restaurant.plan_id || '';
    const matchedPlan = plans.find(p => p.id === currentPlanId);
    const defaultPlanName = restaurant.overriden_plan || (matchedPlan ? matchedPlan.name : (restaurant.selectedPlan || 'Starter'));

    setOverrideForm({
      planId: currentPlanId || (plans[0]?.id || ''),
      selectedPlan: defaultPlanName,
      isPlanOverridden: restaurant.is_plan_overridden ?? true,
      overriddenPlan: restaurant.overriden_plan || defaultPlanName,
      note: ''
    });
    setOverrideModalOpen(true);
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!selectedRestaurantForOverride) return;

    setIsSavingOverride(true);
    try {
      const selectedPlanObj = plans.find(p => p.id === overrideForm.planId);
      const effectivePlanName = overrideForm.overriddenPlan?.trim() || (selectedPlanObj ? selectedPlanObj.name : overrideForm.selectedPlan);

      const payload = {
        planId: overrideForm.planId,
        selectedPlan: effectivePlanName,
        isPlanOverridden: Boolean(overrideForm.isPlanOverridden),
        overriddenPlan: overrideForm.isPlanOverridden ? effectivePlanName.toUpperCase() : null,
        note: overrideForm.note?.trim() || `Plan override set to ${effectivePlanName} by Admin`
      };

      const resId = selectedRestaurantForOverride.id || selectedRestaurantForOverride._id;
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${resId}/billing`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setOverrideModalOpen(false);
        setSelectedRestaurantForOverride(null);
        await fetchData();
        toast.success('Restaurant plan successfully updated!');
      } else {
        toast.error(data.message || 'Failed to update restaurant plan override');
      }
    } catch (err) {
      console.error('[PlanManagement] Error saving plan override:', err);
      toast.error('Network error while saving plan override');
    } finally {
      setIsSavingOverride(false);
    }
  };

  const handleRemoveOverride = async (restaurant) => {
    const ok = await showConfirm({
      title: 'Reset Plan Override',
      message: `Reset "${restaurant.name}" back to standard platform plan tier?`,
      confirmText: 'Reset',
      type: 'warning'
    });
    if (!ok) return;

    try {
      const assignedPlan = plans.find(p => p.id === restaurant.plan_id) || plans[0];
      const payload = {
        planId: assignedPlan?.id,
        selectedPlan: assignedPlan?.name || 'Starter',
        isPlanOverridden: false,
        overriddenPlan: null,
        note: 'Override cleared by Admin'
      };

      const resId = restaurant.id || restaurant._id;
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${resId}/billing`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
        toast.success(`Plan override removed for "${restaurant.name}"`);
      } else {
        toast.error(data.message || 'Failed to remove plan override');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error removing plan override');
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
      toast.warning('Plan name is required');
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
        toast.success(editingPlan ? 'Plan updated successfully!' : 'New plan created successfully!');
      } else {
        toast.error(data.message || 'Failed to save plan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error saving plan');
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
        toast.success(`Plan marked as ${newStatus === 'ACTIVE' ? 'Active' : 'Inactive'}`);
      } else {
        toast.error(data.message || 'Failed to update plan status');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error updating plan status');
    }
  };

  const handleDeletePlan = async (planId) => {
    const ok = await showConfirm({
      title: 'Delete Subscription Plan',
      message: 'Are you sure you want to delete this plan? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plans/${planId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        toast.success('Plan deleted successfully');
      } else {
        toast.error(data.message || 'Cannot delete plan');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error deleting plan');
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
        toast.success('Plan change request approved successfully!');
      } else {
        toast.error(data.message || 'Failed to approve request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error approving request');
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
        toast.info('Plan change request rejected');
      } else {
        toast.error(data.message || 'Failed to reject request');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error rejecting request');
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
    const matchesPlan = selectedPlanFilter === 'ALL' || 
      r.plan_id === selectedPlanFilter ||
      ((r.selectedPlan || '').toUpperCase() === (plans.find(p => p.id === selectedPlanFilter)?.name || '').toUpperCase());
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
      <div className="flex border-b border-gray-200 gap-6 text-sm font-semibold overflow-x-auto no-scrollbar scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              const assignedCount = restaurants.filter(r => 
                r.plan_id === p.id || 
                ((r.selectedPlan || '').toUpperCase() === (p.name || '').toUpperCase())
              ).length;

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
                        <span>{limits.maxTables === null || limits.maxTables === undefined ? <strong>Unlimited</strong> : <>Up to <strong>{limits.maxTables}</strong></>} Tables</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Store size={14} className="text-emerald-600 shrink-0" />
                        <span>{limits.maxMenuItems === null || limits.maxMenuItems === undefined ? <strong>Unlimited</strong> : <>Up to <strong>{limits.maxMenuItems}</strong></>} Menu Items</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-emerald-600 shrink-0" />
                        <span>{limits.maxStaffAccounts === null || limits.maxStaffAccounts === undefined ? <strong>Unlimited</strong> : <>Up to <strong>{limits.maxStaffAccounts}</strong></>} Staff Accounts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-emerald-600 shrink-0" />
                        <span><strong>{limits.orderHistoryDays === null || limits.orderHistoryDays === undefined ? 'Unlimited' : `${limits.orderHistoryDays} Days`}</strong> Order History</span>
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
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanFilter(p.id);
                        setActiveTab('assignments');
                      }}
                      className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer group"
                      title="View restaurants on this plan"
                    >
                      <span>{assignedCount} Restaurant{assignedCount !== 1 ? 's' : ''}</span>
                      <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>

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
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <Sparkles size={10} /> Overridden: {r.overriden_plan || 'Custom'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOverride(r)}
                                  className="text-[10px] text-gray-400 hover:text-rose-600 underline cursor-pointer"
                                  title="Reset to standard platform tier"
                                >
                                  Reset
                                </button>
                              </div>
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
                            {r.createdat || r.createdAt ? new Date(r.createdat || r.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenOverrideModal(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition shadow-2xs cursor-pointer"
                              title="Override or change plan for this restaurant"
                            >
                              <Sparkles size={13} className="text-emerald-600" />
                              Override Plan
                            </button>
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

      {/* ── OVERRIDE RESTAURANT PLAN MODAL ── */}
      {overrideModalOpen && selectedRestaurantForOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-gray-100 my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 font-serif">
                    Override Restaurant Plan
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-semibold text-gray-800">{selectedRestaurantForOverride.name}</span>
                    <span className="mx-1.5 text-gray-300">•</span>
                    <span className="font-mono text-gray-600">{selectedRestaurantForOverride.domain}.dynease.in</span>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setOverrideModalOpen(false); setSelectedRestaurantForOverride(null); }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="mt-4 space-y-4 text-xs">
              {/* Informative Callout */}
              <div className="p-3 bg-purple-50 border border-purple-200/60 rounded-xl text-purple-900 leading-relaxed text-[11px] flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Immediate Subscription Override:</span> Changing this plan will update 
                  the restaurant's feature access and entitlements instantly without requiring owner checkout.
                </div>
              </div>

              {/* Status Comparison Card */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Currently Active</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-gray-900">
                      {selectedRestaurantForOverride.overriden_plan || selectedRestaurantForOverride.selectedPlan || 'Starter'}
                    </span>
                    {selectedRestaurantForOverride.is_plan_overridden && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700">
                        Overridden
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Selected Target Tier</span>
                  <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                    {overrideForm.selectedPlan || 'Choose below'}
                  </span>
                </div>
              </div>

              {/* Plan Picker Grid */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1.5">
                  Select Subscription Plan Tier *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {plans.map((p) => {
                    const isSelected = overrideForm.planId === p.id;
                    const cfg = p.configuration || {};
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setOverrideForm({
                            ...overrideForm,
                            planId: p.id,
                            selectedPlan: p.name,
                            overriddenPlan: p.name.toUpperCase()
                          });
                        }}
                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="font-bold text-xs">{p.name}</div>
                        <div className="text-[10px] text-gray-500 font-semibold mt-1">
                          {cfg.monthlyDisplayPrice ? `₹${cfg.monthlyDisplayPrice}/mo` : 'Custom'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle: Flag as Plan Override */}
              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrideForm.isPlanOverridden}
                    onChange={(e) => setOverrideForm({ ...overrideForm, isPlanOverridden: e.target.checked })}
                    className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-gray-800 block text-xs">
                      Flag as Manual Plan Override
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      Marks this restaurant with the purple Override badge and prevents automatic tier downgrades.
                    </span>
                  </div>
                </label>
              </div>

              {/* Custom Override Label */}
              {overrideForm.isPlanOverridden && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Override Plan Label / Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={overrideForm.overriddenPlan}
                    onChange={(e) => setOverrideForm({ ...overrideForm, overriddenPlan: e.target.value.toUpperCase() })}
                    placeholder="e.g. STARTER, GROWTH, BUSINESS, PRO, ENTERPRISE"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 font-mono text-xs font-bold uppercase tracking-wider text-purple-900"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    This label will be shown in the restaurant admin dashboard and system reports.
                  </p>
                </div>
              )}

              {/* Admin Note */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reason / Note for Audit Trail</label>
                <input
                  type="text"
                  value={overrideForm.note}
                  onChange={(e) => setOverrideForm({ ...overrideForm, note: e.target.value })}
                  placeholder="e.g. Special custom plan approved by Director / promo offer"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {selectedRestaurantForOverride.is_plan_overridden ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveOverride(selectedRestaurantForOverride);
                      setOverrideModalOpen(false);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                    title="Remove override flag and reset to standard tier"
                  >
                    <RotateCcw size={12} />
                    Reset Override
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setOverrideModalOpen(false); setSelectedRestaurantForOverride(null); }}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 cursor-pointer text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingOverride}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs transition"
                  >
                    <Sparkles size={14} />
                    {isSavingOverride ? 'Saving...' : 'Apply Plan Override'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
