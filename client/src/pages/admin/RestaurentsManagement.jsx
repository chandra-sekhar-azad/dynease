import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, Trash2, Edit, Search, X, Send, CheckCircle, Loader, Eye, EyeOff, 
  AlertTriangle, Clock, CreditCard, Store, Layers, RefreshCw, 
  Sparkles, Check, CheckCircle2, Inbox, Mail, Phone, Building2
} from 'lucide-react';
import { authFetch } from '../../utils/api';
import { useSocketEvents } from '../../lib/socket';

export default function RestaurantsManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'restaurants'; // 'restaurants' | 'requests' | 'billing' | 'plans'
  const [activeTab, setActiveTab] = useState(
    initialTab === 'billing' || initialTab === 'subscriptions' ? 'billing' :
    initialTab === 'plans' ? 'plans' :
    initialTab === 'requests' || initialTab === 'registrations' ? 'requests' : 'restaurants'
  );

  const [restaurants, setRestaurants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Registration Requests tab state
  const [requests, setRequests] = useState([]);
  const [selectedReq, setSelectedReq] = useState(null);
  const [requestActionLoading, setRequestActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Modals state for Restaurant Directory
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sendingCredentials, setSendingCredentials] = useState({});
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Edit / Manage Plan & Billing Modal State
  const [editingRestaurantBilling, setEditingRestaurantBilling] = useState(null);
  const [editDaysRemaining, setEditDaysRemaining] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editPlan, setEditPlan] = useState('STARTER');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editNote, setEditNote] = useState('');
  const [isSavingBilling, setIsSavingBilling] = useState(false);

  // Filters for Billing tab
  const [selectedPlanFilter, setSelectedPlanFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [onlyExpiringSoon, setOnlyExpiringSoon] = useState(false);

  // Form data for Restaurant Directory
  const [editFormData, setEditFormData] = useState({
    name: '',
    subscriptionPlan: 'FREE',
    subscriptionStatus: 'ACTIVE',
    billingDaysRemaining: 0,
    isActive: true,
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    googleReviewLink: ''
  });

  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    ownerPassword: ''
  });

  // Sync activeTab with URL params if tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'billing' || tabParam === 'subscriptions') {
      setActiveTab('billing');
    } else if (tabParam === 'plans') {
      setActiveTab('plans');
    } else if (tabParam === 'requests' || tabParam === 'registrations') {
      setActiveTab('requests');
    } else if (tabParam === 'restaurants') {
      setActiveTab('restaurants');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resRes, plansRes, reqRes] = await Promise.all([
        authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants`),
        authFetch(`${import.meta.env.VITE_API_URL}/admin/plans`),
        authFetch(`${import.meta.env.VITE_API_URL}/admin/requests`)
      ]);
      const resData = await resRes.json();
      const plansData = await plansRes.json();
      const reqData = await reqRes.json();

      if (resData.success) {
        setRestaurants(resData.data.restaurants || []);
      }
      if (plansData.success) {
        setPlans(plansData.data.plans || []);
      }
      if (reqData.success) {
        setRequests(reqData.data.requests || []);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Realtime: new registrations / approvals / plan requests from anywhere.
  useSocketEvents({
    restaurant_registered: () => fetchData(),
    restaurant_updated: () => fetchData(),
    plan_request: () => fetchData(),
    plan_request_updated: () => fetchData(),
  });

  // ── Handlers for Restaurant Directory ──
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setFormData({ restaurantName: '', ownerName: '', ownerPhone: '', ownerEmail: '', ownerPassword: '' });
        fetchData();
        alert('Restaurant and Owner Account Created Successfully!');
      } else {
        alert(data.message || 'Error creating restaurant');
      }
    } catch (err) {
      alert('Network error. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this restaurant? This action cannot be undone.')) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        alert('Restaurant deleted successfully');
      } else {
        alert(data.message || 'Error deleting restaurant');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handleSendCredentials = async (restaurantId) => {
    setSendingCredentials(prev => ({ ...prev, [restaurantId]: 'sending' }));
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${restaurantId}/send-credentials`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setSendingCredentials(prev => ({ ...prev, [restaurantId]: 'sent' }));
        setTimeout(() => setSendingCredentials(prev => ({ ...prev, [restaurantId]: 'idle' })), 3000);
      } else {
        setSendingCredentials(prev => ({ ...prev, [restaurantId]: 'idle' }));
        alert(data.message || 'Failed to send credentials via WhatsApp');
      }
    } catch (err) {
      console.error(err);
      setSendingCredentials(prev => ({ ...prev, [restaurantId]: 'idle' }));
      alert('Network error while sending WhatsApp message.');
    }
  };

  const handleToggleStatus = async (restaurant) => {
    const newStatus = (restaurant.isActive || restaurant.status === 'ACTIVE') ? false : true;
    setTogglingStatus(restaurant._id);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${restaurant._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: restaurant.name,
          isActive: newStatus,
          subscriptionPlan: restaurant.selectedPlan || restaurant.subscriptionPlan
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message || 'Failed to update status');
      }
    } catch (err) {
      alert('Network error updating restaurant status');
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleApprovePlanRequest = async (requestId) => {
    if (!window.confirm('Approve this subscription plan change request? The restaurant plan will be updated.')) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plan-requests/${requestId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Plan change request approved successfully!');
        fetchData();
      } else {
        alert(data.message || 'Failed to approve plan change request');
      }
    } catch (err) {
      alert('Network error approving plan change request');
    }
  };

  const handleRejectPlanRequest = async (requestId) => {
    const reason = window.prompt('Enter reason for rejecting this plan change request:', 'Plan change request rejected');
    if (!reason) return;
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/plan-requests/${requestId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('Plan change request rejected.');
        fetchData();
      } else {
        alert(data.message || 'Failed to reject plan change request');
      }
    } catch (err) {
      alert('Network error rejecting plan change request');
    }
  };

  // ── Handlers for Registration Requests ──
  const getRequestId = (request) => request?.id || request?._id;

  const handleApproveRegistration = async (request) => {
    const id = getRequestId(request);
    if (!id) return;
    if (!window.confirm(`Approve "${request.name}"? The restaurant and its owner account will be activated.`)) return;

    setRequestActionLoading(id);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/requests/${id}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(prev => prev.filter(r => getRequestId(r) !== id));
        setSelectedReq(null);
        fetchData();
      } else {
        alert(data.message || 'Failed to approve request');
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Network error while approving request');
    } finally {
      setRequestActionLoading(null);
    }
  };

  const handleRejectRegistration = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;

    const id = getRequestId(selectedReq);
    setRequestActionLoading(id);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(prev => prev.filter(r => getRequestId(r) !== id));
        setShowRejectModal(false);
        setSelectedReq(null);
        setRejectReason('');
      } else {
        alert(data.message || 'Failed to reject request');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Network error while rejecting request');
    } finally {
      setRequestActionLoading(null);
    }
  };

  const openEditModal = (restaurant) => {
    setEditingId(restaurant._id);
    setEditFormData({
      name: restaurant.name,
      subdomain: restaurant.subdomain || restaurant.slug || '',
      subscriptionPlan: restaurant.selectedPlan || 'FREE',
      subscriptionStatus: restaurant.subscriptionStatus || 'ACTIVE',
      billingDaysRemaining: restaurant.daysRemaining !== undefined ? restaurant.daysRemaining : 0,
      isActive: restaurant.isActive || restaurant.status === 'ACTIVE',
      ownerName: restaurant.ownerId?.name || '',
      ownerEmail: restaurant.ownerId?.email || '',
      ownerPhone: restaurant.ownerId?.phone || '',
      googleReviewLink: restaurant.googleReviewLink || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();
      if (data.success) {
        setShowEditModal(false);
        fetchData();
        alert('Restaurant updated successfully!');
      } else {
        alert(data.message || 'Error updating restaurant');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setIsLoading(false);
    }
  };


  // ── Handlers for Subscription & Billing ──
  const openBillingModal = (restaurant) => {
    setEditingRestaurantBilling(restaurant);
    const days = restaurant.daysRemaining !== undefined ? restaurant.daysRemaining : 0;
    setEditDaysRemaining(days);
    
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

  const handleBillingDaysChange = (newDays) => {
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

  const handleBillingDateChange = (dateStr) => {
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

  const handleSaveBilling = async (e) => {
    e.preventDefault();
    if (!editingRestaurantBilling) return;

    setIsSavingBilling(true);
    try {
      const payload = {
        daysRemaining: parseInt(editDaysRemaining, 10),
        subscriptionEndDate: editEndDate ? new Date(editEndDate).toISOString() : undefined,
        selectedPlan: editPlan,
        subscriptionStatus: editStatus,
        note: editNote || `Admin updated plan to ${editPlan} (${editDaysRemaining} days remaining)`
      };

      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${editingRestaurantBilling._id}/billing`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setEditingRestaurantBilling(null);
        await fetchData();
        alert('Subscription & Billing updated successfully!');
      } else {
        alert(data.message || 'Failed to update billing details');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while updating billing');
    } finally {
      setIsSavingBilling(false);
    }
  };

  const handleDirectAddDays = async (restaurant, daysToAdd) => {
    const current = restaurant.daysRemaining || 0;
    const newDays = current + daysToAdd;
    if (!window.confirm(`Extend ${restaurant.name} subscription by +${daysToAdd} days (total ${newDays} days remaining)?`)) return;

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/restaurants/${restaurant._id}/billing`, {
        method: 'PUT',
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

  // ── Metrics & Calculations ──
  const activeSubsCount = restaurants.filter(r => r.subscriptionStatus === 'ACTIVE').length;
  const trialSubsCount = restaurants.filter(r => r.subscriptionStatus === 'TRIAL').length;
  const expiringSoonCount = restaurants.filter(r => r.daysRemaining <= 7 && r.daysRemaining > 0).length;
  const expiredCount = restaurants.filter(r => r.subscriptionStatus === 'EXPIRED' || (r.daysRemaining === 0 && r.subscriptionEndDate)).length;
  const pendingRequestsCount = restaurants.filter(r => r.renewalRequest?.status === 'PENDING').length;
  const pendingRegistrationsCount = requests.length;

  const filteredBillingRestaurants = restaurants.filter(r => {
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

  const filteredRestaurantsDirectory = restaurants.filter(r => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      r.name?.toLowerCase().includes(q) ||
      r.slug?.toLowerCase().includes(q) ||
      r.subdomain?.toLowerCase().includes(q) ||
      r.ownerId?.name?.toLowerCase().includes(q) ||
      r.ownerId?.email?.toLowerCase().includes(q) ||
      r.ownerId?.phone?.includes(q)
    );
  });

  const planOptions = [
    { id: 'STARTER', name: 'Starter', price: '₹999/mo', desc: 'Up to 5 tables • 3 staff' },
    { id: 'GROWTH', name: 'Growth', price: '₹1,999/mo', desc: 'Up to 20 tables • 10 staff', popular: true },
    { id: 'BUSINESS', name: 'Business', price: '₹3,499/mo', desc: 'Up to 40 tables • 30 staff • Multi-outlet' },
    { id: 'PRO', name: 'Pro / Custom', price: 'Enterprise', desc: 'Unlimited tables & staff' },
    { id: 'FREE', name: 'Free Trial', price: '₹0', desc: '14-day evaluation trial' }
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Header & Tab Navigation ── */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <Store size={22} />
            </span>
            <h1 className="text-2xl font-bold font-serif text-gray-900 tracking-tight">
              Restaurant Management
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Unified control center for restaurant profiles, subscription tracking, billing renewal, and platform plan tiers.
          </p>
        </div>

        {/* View Mode Tabs (Merged Navigation) */}
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
            <button
              onClick={() => handleTabChange('restaurants')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'restaurants'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Store size={14} />
              <span>Restaurants</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700">
                {restaurants.length}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('requests')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'requests'
                  ? 'bg-white text-amber-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Inbox size={14} />
              <span>Registration Requests</span>
              {pendingRegistrationsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold animate-pulse">
                  {pendingRegistrationsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('billing')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'billing'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <CreditCard size={14} />
              <span>Subscription & Billing</span>
              {expiringSoonCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-extrabold animate-pulse">
                  {expiringSoonCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('plans')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'plans'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Layers size={14} />
              <span>Plan Tiers</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all shadow-xs cursor-pointer disabled:opacity-60"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-emerald-600' : ''} />
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. RESTAURANTS DIRECTORY TAB                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'restaurants' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50/50">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search restaurants, owners, phones..." 
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-gray-900 bg-white"
                />
              </div>

              <button 
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <Plus size={16} /> Add Restaurant
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="p-4">Restaurant</th>
                    <th className="p-4">Owner</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Subscription Plan</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRestaurantsDirectory.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-gray-400 font-medium">
                        No restaurants found. Click "Add Restaurant" to provision a new tenant!
                      </td>
                    </tr>
                  ) : filteredRestaurantsDirectory.map(res => {
                    const credStatus = sendingCredentials[res._id] || 'idle';
                    return (
                      <tr key={res._id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{res.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{res.slug}.dynease.in</div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{res.ownerId?.name || 'N/A'}</div>
                          <div className="text-xs text-gray-400">{res.ownerId?.phone || res.ownerId?.email || ''}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center">
                            <button
                              onClick={() => handleToggleStatus(res)}
                              disabled={togglingStatus === res._id}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                                (res.isActive || res.status === 'ACTIVE') ? 'bg-emerald-600' : 'bg-gray-300'
                              } ${togglingStatus === res._id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  (res.isActive || res.status === 'ACTIVE') ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className="ml-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {res.isActive || res.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase ${
                              res.selectedPlan === 'PRO' ? 'bg-purple-100 text-purple-700' :
                              res.selectedPlan === 'GROWTH' ? 'bg-emerald-100 text-emerald-800' :
                              res.selectedPlan === 'BUSINESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {res.selectedPlan || 'FREE'}
                            </span>
                            <div className="flex items-center gap-1">
                              {res.daysRemaining !== undefined && (
                                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                                  res.daysRemaining === 0 || res.subscriptionStatus === 'EXPIRED'
                                    ? 'bg-rose-100 text-rose-700'
                                    : res.daysRemaining <= 3
                                    ? 'bg-red-100 text-red-800 animate-pulse'
                                    : res.daysRemaining <= 7
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  <Clock size={10} />
                                  <span>{res.daysRemaining}d left</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => handleSendCredentials(res._id)}
                              disabled={credStatus === 'sending'}
                              title="Send login credentials via WhatsApp"
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                credStatus === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                                credStatus === 'sending' ? 'bg-blue-50 text-blue-400 cursor-wait' :
                                'bg-blue-50 text-blue-600 hover:bg-blue-100'
                              }`}
                            >
                              {credStatus === 'sent' ? <><CheckCircle size={13} /> Sent!</> : credStatus === 'sending' ? <><Loader size={13} className="animate-spin" /> Sending...</> : <><Send size={13} /> Send Creds</>}
                            </button>
                            
                            <button
                              onClick={() => openBillingModal(res)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-all border border-emerald-200 cursor-pointer shadow-xs"
                              title="Manage subscription days & billing"
                            >
                              <CreditCard size={13} />
                              <span>Billing</span>
                            </button>

                            <button onClick={() => openEditModal(res)} className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit Restaurant">
                              <Edit size={16} />
                            </button>

                            <button onClick={() => handleDelete(res._id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. REGISTRATION REQUESTS TAB                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Inbox size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Pending Registration Requests</h2>
                  <p className="text-xs text-gray-500">Review, approve, or reject new restaurant onboarding applications.</p>
                </div>
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                {requests.length} Pending
              </span>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start p-4 lg:p-6">
              {/* Requests List */}
              <div className={`w-full ${selectedReq ? 'hidden lg:block lg:w-1/2' : 'lg:w-full'}`}>
                {requests.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-400 font-medium flex flex-col items-center">
                    <Inbox size={40} className="text-gray-200 mb-3" />
                    No pending registration requests.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {requests.map(request => {
                      const reqId = getRequestId(request);
                      const isSelected = getRequestId(selectedReq) === reqId;
                      return (
                        <div
                          key={reqId}
                          onClick={() => setSelectedReq(request)}
                          className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500'
                              : 'border-gray-200 hover:border-emerald-300 shadow-xs hover:shadow'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <h3 className="font-bold text-gray-900">{request.name}</h3>
                            <span className="shrink-0 bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-1 rounded uppercase tracking-wide">
                              Pending
                            </span>
                          </div>
                          <p className="text-xs text-emerald-600 mb-2 font-semibold">{request.slug}.dynease.in</p>
                          <div className="flex justify-between items-center text-xs gap-2">
                            <span className="text-gray-500 truncate">Owner: {request.ownerId?.name || 'N/A'}</span>
                            <span className="shrink-0 font-bold text-emerald-700">{request.selectedPlan}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Application Details */}
              {selectedReq && (
                <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden lg:sticky lg:top-6">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Building2 size={18} className="text-emerald-700" /> Application Details
                    </h3>
                    <button
                      onClick={() => setSelectedReq(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
                      title="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="p-5 space-y-6">
                    <div>
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Restaurant Information</h4>
                      <div className="space-y-2.5 text-sm text-gray-900">
                        <p className="flex"><span className="font-medium text-gray-500 w-28 shrink-0">Name:</span> <span className="font-semibold">{selectedReq.name}</span></p>
                        <p className="flex"><span className="font-medium text-gray-500 w-28 shrink-0">Domain:</span> {selectedReq.slug}.dynease.in</p>
                        <p className="flex"><span className="font-medium text-gray-500 w-28 shrink-0">Address:</span> {selectedReq.address || 'N/A'}</p>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div>
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Owner Information</h4>
                      <div className="space-y-2.5 text-sm text-gray-900">
                        <p className="flex"><span className="font-medium text-gray-500 w-28 shrink-0">Full Name:</span> {selectedReq.ownerId?.name || 'N/A'}</p>
                        <p className="flex items-center gap-1.5"><span className="font-medium text-gray-500 w-28 shrink-0">Mobile:</span> <Phone size={13} className="text-gray-400" /> {selectedReq.ownerId?.phone || 'N/A'}</p>
                        <p className="flex items-center gap-1.5 break-all"><span className="font-medium text-gray-500 w-28 shrink-0">Email:</span> <Mail size={13} className="text-gray-400 shrink-0" /> {selectedReq.ownerId?.email || 'N/A'}</p>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    <div>
                      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Subscription Plan</h4>
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold uppercase">
                        <CreditCard size={14} /> {selectedReq.selectedPlan || 'STARTER'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
                    <button
                      onClick={() => handleApproveRegistration(selectedReq)}
                      disabled={requestActionLoading === getRequestId(selectedReq)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                    >
                      {requestActionLoading === getRequestId(selectedReq)
                        ? <><Loader size={14} className="animate-spin" /> Approving...</>
                        : <><Check size={16} /> Approve</>}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={requestActionLoading === getRequestId(selectedReq)}
                      className="flex-1 border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60 font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-colors flex justify-center items-center gap-2 cursor-pointer"
                    >
                      <X size={16} /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. SUBSCRIPTION & BILLING TAB (MERGED)                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {pendingRequestsCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <h4 className="font-bold text-sm">Action Needed: {pendingRequestsCount} Pending Renewal Request{pendingRequestsCount > 1 ? 's' : ''}</h4>
                  <p className="text-xs text-amber-700 mt-0.5">One or more restaurants have submitted renewal or upgrade requests awaiting approval.</p>
                </div>
              </div>
            </div>
          )}

          {pendingRequestsCount > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <CreditCard size={18} className="text-amber-700" />
                <h3 className="font-bold text-gray-900 text-sm">Review Pending Plan Requests</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {restaurants.filter(r => r.renewalRequest?.status === 'PENDING').map(r => (
                  <div key={r._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{r.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>Requested Plan: <strong className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase">{r.renewalRequest.plan}</strong></span>
                        {r.renewalRequest.createdAt && (
                          <span className="text-gray-400">({new Date(r.renewalRequest.createdAt).toLocaleDateString()})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprovePlanRequest(r.renewalRequest.id || r.renewalRequest._id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check size={14} /> Approve Plan
                      </button>
                      <button
                        onClick={() => handleRejectPlanRequest(r.renewalRequest.id || r.renewalRequest._id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-300 text-rose-700 hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Subscriptions</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{activeSubsCount}</p>
              </div>
              <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle2 size={22} />
              </span>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expiring in 7 Days</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{expiringSoonCount}</p>
              </div>
              <span className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                <Clock size={22} />
              </span>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trial Plans</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{trialSubsCount}</p>
              </div>
              <span className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                <Sparkles size={22} />
              </span>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-gray-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Expired / Grace</p>
                <p className="text-2xl font-black text-rose-600 mt-1">{expiredCount}</p>
              </div>
              <span className="p-2.5 bg-rose-50 text-rose-700 rounded-xl">
                <AlertTriangle size={22} />
              </span>
            </div>
          </div>

          {/* Billing Search & Filter Toolbar */}
          <div className="bg-white p-4.5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by restaurant name, owner, or domain..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPlanFilter}
                onChange={(e) => setSelectedPlanFilter(e.target.value)}
                className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Plans</option>
                <option value="STARTER">Starter</option>
                <option value="GROWTH">Growth</option>
                <option value="BUSINESS">Business</option>
                <option value="PRO">Pro</option>
                <option value="FREE">Free Trial</option>
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIAL">Trial</option>
                <option value="EXPIRED">Expired</option>
              </select>

              <button
                onClick={() => setOnlyExpiringSoon(!onlyExpiringSoon)}
                className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  onlyExpiringSoon
                    ? 'bg-amber-100 text-amber-900 border-amber-300 ring-2 ring-amber-300/30'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Clock size={14} className={onlyExpiringSoon ? 'text-amber-700' : 'text-gray-400'} />
                <span>Expiring Soon (≤ 7d)</span>
              </button>
            </div>
          </div>

          {/* Subscriptions & Billing Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="p-4">Restaurant</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Days Remaining</th>
                    <th className="p-4">Expiration Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Billing Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBillingRestaurants.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-gray-400 font-medium">
                        No restaurant subscriptions found matching the selected filters.
                      </td>
                    </tr>
                  ) : filteredBillingRestaurants.map(r => (
                    <tr key={r._id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{r.name}</div>
                        <div className="text-xs text-gray-400">{r.subdomain || r.slug}.dynease.in</div>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold uppercase ${
                          r.selectedPlan === 'PRO' ? 'bg-purple-100 text-purple-700' :
                          r.selectedPlan === 'GROWTH' ? 'bg-emerald-100 text-emerald-800' :
                          r.selectedPlan === 'BUSINESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {r.selectedPlan || 'FREE'}
                        </span>
                        {r.renewalRequest?.status === 'PENDING' && (
                          <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                            <AlertTriangle size={11} /> Request: {r.renewalRequest.plan}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          r.daysRemaining === 0 || r.subscriptionStatus === 'EXPIRED'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : r.daysRemaining <= 3
                            ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                            : r.daysRemaining <= 7
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <Clock size={12} />
                          <span>{r.daysRemaining !== undefined ? `${r.daysRemaining} days` : '0 days'}</span>
                        </span>
                      </td>

                      <td className="p-4 text-xs text-gray-600">
                        {r.subscriptionEndDate ? new Date(r.subscriptionEndDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        }) : 'Not Set'}
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          r.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                          r.subscriptionStatus === 'TRIAL' ? 'bg-blue-100 text-blue-700' :
                          r.subscriptionStatus === 'EXPIRED' ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.subscriptionStatus || 'INACTIVE'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => handleDirectAddDays(r, 30)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all border border-emerald-200 cursor-pointer"
                            title="Quick extend subscription by 30 days"
                          >
                            +30 Days
                          </button>

                          <button
                            onClick={() => openBillingModal(r)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-900 hover:bg-black text-white transition-all shadow-xs cursor-pointer"
                          >
                            Manage Plan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. PLATFORM PLAN TIERS TAB                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'plans' && (
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
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
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
                        <span className="text-xs text-gray-400 font-medium">/month</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{p.description}</p>
                    </div>

                    <div className="border-t border-gray-100 my-4 pt-4 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span>Up to <strong>{p.maxTables >= 9999 ? 'Unlimited' : p.maxTables}</strong> tables</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Check size={14} className="text-emerald-600 shrink-0" />
                        <span>Up to <strong>{p.maxStaff >= 9999 ? 'Unlimited' : p.maxStaff}</strong> staff logins</span>
                      </div>
                      {p.features?.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-gray-600">
                          <Check size={14} className="text-emerald-600 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 text-center">
                    <span className="text-xs font-bold text-emerald-700">Configured in Platform</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: Add Restaurant                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Store className="text-emerald-600" size={20} /> Add New Restaurant
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Restaurant Name</label>
                <input 
                  type="text" 
                  name="restaurantName"
                  required
                  value={formData.restaurantName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Spice Symphony"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Name</label>
                <input 
                  type="text" 
                  name="ownerName"
                  required
                  value={formData.ownerName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Email</label>
                <input 
                  type="email" 
                  name="ownerEmail"
                  required
                  value={formData.ownerEmail}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. rahul@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Phone (WhatsApp)</label>
                <input 
                  type="text" 
                  name="ownerPhone"
                  required
                  value={formData.ownerPhone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    name="ownerPassword"
                    required
                    value={formData.ownerPassword}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none pr-10"
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5"
                >
                  {isLoading && <Loader size={14} className="animate-spin" />}
                  <span>Provision Restaurant</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: Edit Restaurant Directory                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Edit Restaurant Details</h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Restaurant Name</label>
                <input 
                  type="text" 
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Subdomain</label>
                <input 
                  type="text" 
                  disabled
                  value={editFormData.subdomain}
                  className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Name</label>
                  <input 
                    type="text" 
                    value={editFormData.ownerName}
                    onChange={(e) => setEditFormData({ ...editFormData, ownerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Phone</label>
                  <input 
                    type="text" 
                    value={editFormData.ownerPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, ownerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: Manage Subscription & Billing                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editingRestaurantBilling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative border border-gray-100">
            <button 
              onClick={() => setEditingRestaurantBilling(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <CreditCard size={20} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Manage Subscription & Billing</h3>
                <p className="text-xs text-gray-400">{editingRestaurantBilling.name} ({editingRestaurantBilling.subdomain}.dynease.in)</p>
              </div>
            </div>

            <form onSubmit={handleSaveBilling} className="mt-5 space-y-4">
              {editingRestaurantBilling.renewalRequest?.status === 'PENDING' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle size={13} />
                      Pending Request: {editingRestaurantBilling.renewalRequest.plan} Plan
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      Requested {editingRestaurantBilling.renewalRequest.requestedAt ? new Date(editingRestaurantBilling.renewalRequest.requestedAt).toLocaleDateString() : 'recently'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPlan(editingRestaurantBilling.renewalRequest.plan);
                      handleBillingDaysChange(30);
                    }}
                    className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                  >
                    Apply Request
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Subscription Plan</label>
                <div className="grid grid-cols-3 gap-2">
                  {planOptions.map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setEditPlan(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        editPlan === opt.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/20'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="text-xs font-black">{opt.name}</div>
                      <div className="text-[10px] text-gray-500 font-semibold mt-0.5">{opt.price}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Days Remaining</label>
                  <input
                    type="number"
                    min="0"
                    value={editDaysRemaining}
                    onChange={(e) => handleBillingDaysChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Subscription End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => handleBillingDateChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Subscription Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="TRIAL">TRIAL</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Admin Action Note</label>
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g. Received offline payment, extended 30 days"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRestaurantBilling(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBilling}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSavingBilling && <Loader size={14} className="animate-spin" />}
                  <span>Save Billing Details</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: Reject Registration Request                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showRejectModal && selectedReq && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Reject Registration</h3>
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRejectRegistration} className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for rejecting <span className="font-bold text-gray-900">{selectedReq.name}</span>.
                This will be recorded and shared if necessary.
              </p>

              <textarea
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="E.g. Duplicate registration, unverifiable details..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none mb-5 resize-none"
              ></textarea>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                  className="flex-1 py-2.5 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestActionLoading === getRequestId(selectedReq)}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-xl transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
                >
                  {requestActionLoading === getRequestId(selectedReq)
                    ? <><Loader size={14} className="animate-spin" /> Rejecting...</>
                    : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
