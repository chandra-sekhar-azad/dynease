import React, { useState, useEffect } from 'react';
import { 
  CreditCard, CheckCircle, AlertTriangle, Clock, Sparkles, 
  ArrowUpRight, RefreshCw, Layers, Grid, Utensils, Users, 
  Building2, Check, X, ShieldAlert, ChevronRight, Download
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RestaurantSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('GROWTH');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const currentHostname = window.location.hostname;
      let subdomain = '';
      if (currentHostname.includes('localhost') && currentHostname !== 'localhost') {
        subdomain = currentHostname.split('.')[0];
      } else if (currentHostname.includes('dynease.in') && currentHostname !== 'dynease.in') {
        subdomain = currentHostname.split('.')[0];
      }
      if (subdomain) headers['x-tenant-subdomain'] = subdomain;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/subscription`, { headers });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.data);
      } else {
        setError(data.message || 'Failed to load subscription');
      }
    } catch {
      setError('Network error fetching subscription');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChangeRequest = async () => {
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      const token = localStorage.getItem('token');
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      const currentHostname = window.location.hostname;
      let subdomain = '';
      if (currentHostname.includes('localhost') && currentHostname !== 'localhost') {
        subdomain = currentHostname.split('.')[0];
      } else if (currentHostname.includes('dynease.in') && currentHostname !== 'dynease.in') {
        subdomain = currentHostname.split('.')[0];
      }
      if (subdomain) headers['x-tenant-subdomain'] = subdomain;

      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/subscription/renew`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan: selectedPlan, billingCycle })
      });
      const data = await res.json();

      if (data.success) {
        setActionMessage({
          type: 'success',
          text: data.message || 'Request submitted successfully. Platform admin will review and activate your plan.'
        });
        setShowModal(false);
        await fetchSubscription();
      } else {
        setActionMessage({
          type: 'error',
          text: data.message || 'Failed to submit plan change request'
        });
      }
    } catch {
      setActionMessage({
        type: 'error',
        text: 'An error occurred while submitting your plan request.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const planOptions = [
    {
      id: 'STARTER',
      name: 'Starter',
      monthlyPrice: 999,
      yearlyPrice: 9990,
      limitsText: '10 Tables • 50 Items • 3 Staff'
    },
    {
      id: 'GROWTH',
      name: 'Growth',
      monthlyPrice: 1999,
      yearlyPrice: 19990,
      limitsText: '30 Tables • 200 Items • 10 Staff • Reports',
      popular: true
    },
    {
      id: 'BUSINESS',
      name: 'Business',
      monthlyPrice: 3499,
      yearlyPrice: 34990,
      limitsText: 'Up to 3 Locations • Unlimited Tables • 30 Staff'
    },
    {
      id: 'PRO',
      name: 'Pro',
      monthlyPrice: 5999,
      yearlyPrice: 59990,
      limitsText: 'Up to 5 Locations • Unlimited Staff • Full CRM & Loyalty'
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin text-emerald-600 w-8 h-8" />
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="p-6 max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
        <AlertTriangle className="text-amber-500 w-12 h-12 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-800">Subscription Status</h2>
        <p className="text-sm text-gray-500 mt-1">{error || 'Unable to retrieve subscription details.'}</p>
        <button onClick={fetchSubscription} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">
          Retry
        </button>
      </div>
    );
  }

  const { plan, planName, status, remainingDays, endDate, startDate, usage, limits } = subscription;
  const isExpired = status === 'EXPIRED' || remainingDays === 0;
  const isPending = subscription.renewalRequest?.status === 'PENDING';

  // Capacity calculations with percentage caps
  const calcPercent = (used, max) => {
    if (max === null || max === undefined) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  };

  const getCapacityColor = (used, max) => {
    if (max === null) return 'bg-emerald-500';
    const pct = (used / max) * 100;
    if (pct >= 100) return 'bg-rose-500';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Action alerts */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl flex items-start gap-3 border ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle size={20} className="shrink-0 text-emerald-600" /> : <AlertTriangle size={20} className="shrink-0 text-rose-600" />}
          <div className="text-xs font-semibold">{actionMessage.text}</div>
        </div>
      )}

      {isPending && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-2xl flex items-center gap-3">
          <Clock className="text-blue-600 shrink-0" size={20} />
          <div className="text-xs">
            <span className="font-bold">Plan Change / Renewal Pending:</span> You requested the{' '}
            <span className="font-extrabold uppercase">{subscription.renewalRequest.plan}</span> plan. Our platform team is processing the activation.
          </div>
        </div>
      )}

      {isExpired && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-rose-600 shrink-0" size={24} />
            <div>
              <h4 className="font-bold text-sm">Subscription Has Expired</h4>
              <p className="text-xs text-rose-700">Digital QR ordering is currently disabled for your tables. Renew your plan to reactivate live dining orders.</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shrink-0 transition-all shadow-sm"
          >
            Renew Now
          </button>
        </div>
      )}

      {/* Primary Subscription Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 bg-gradient-to-r from-gray-50/60 via-white to-emerald-50/20">
          <div className="flex items-start gap-4">
            <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
              <CreditCard size={24} className="sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold font-serif text-gray-900">
                  {planName || plan} Plan
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase ${
                  status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                  status === 'TRIAL' ? 'bg-blue-100 text-blue-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {status}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] sm:text-[11px] font-bold uppercase">
                  {subscription.billingCycle || 'monthly'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Active Period: {startDate ? new Date(startDate).toLocaleDateString() : 'N/A'} –{' '}
                {endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowModal(true)}
              disabled={isPending}
              className="w-full md:w-auto justify-center px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{isPending ? 'Request Pending' : 'Change / Upgrade Plan'}</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        {/* Days Left Banner */}
        <div className="px-6 md:px-8 py-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 text-xs">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <Clock size={16} className="text-emerald-600" />
            <span>Time Remaining:</span>
            <span className={`font-extrabold text-sm ${remainingDays <= 3 ? 'text-rose-600' : 'text-gray-900'}`}>
              {remainingDays} {remainingDays === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="text-gray-500">
            Renewal Date: <strong className="text-gray-800">{endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}</strong>
          </div>
        </div>

        {/* Resource Usage & Capacity Grid */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-base font-bold text-gray-900">Current Resource Usage & Capacity Limits</h2>
            <span className="text-xs text-gray-400">Strict backend-enforced limits</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tables Capacity */}
            <div className="p-5 rounded-2xl bg-gray-50/80 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
                  <span className="flex items-center gap-1.5"><Grid size={14} /> Tables</span>
                  <span className="font-bold text-gray-800">
                    {usage?.tables || 0} / {limits?.maxTables === null ? 'Unlimited' : limits?.maxTables}
                  </span>
                </div>
                {limits?.maxTables !== null ? (
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full ${getCapacityColor(usage?.tables || 0, limits?.maxTables)} transition-all`}
                      style={{ width: `${calcPercent(usage?.tables || 0, limits?.maxTables)}%` }}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-600 font-bold mt-2">Unlimited capacity</div>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                {limits?.maxTables !== null && (usage?.tables || 0) >= limits.maxTables ? (
                  <span className="text-rose-600 font-bold">Limit reached</span>
                ) : (
                  `${subscription.capacityRemaining?.tables === null ? 'No cap' : `${subscription.capacityRemaining?.tables} available`}`
                )}
              </p>
            </div>

            {/* Menu Items */}
            <div className="p-5 rounded-2xl bg-gray-50/80 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
                  <span className="flex items-center gap-1.5"><Utensils size={14} /> Menu Items</span>
                  <span className="font-bold text-gray-800">
                    {usage?.menuItems || 0} / {limits?.maxMenuItems === null ? 'Unlimited' : limits?.maxMenuItems}
                  </span>
                </div>
                {limits?.maxMenuItems !== null ? (
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full ${getCapacityColor(usage?.menuItems || 0, limits?.maxMenuItems)} transition-all`}
                      style={{ width: `${calcPercent(usage?.menuItems || 0, limits?.maxMenuItems)}%` }}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-600 font-bold mt-2">Unlimited dishes</div>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                {limits?.maxMenuItems !== null && (usage?.menuItems || 0) >= limits.maxMenuItems ? (
                  <span className="text-rose-600 font-bold">Limit reached</span>
                ) : (
                  `${subscription.capacityRemaining?.menuItems === null ? 'No cap' : `${subscription.capacityRemaining?.menuItems} slots left`}`
                )}
              </p>
            </div>

            {/* Staff Accounts */}
            <div className="p-5 rounded-2xl bg-gray-50/80 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
                  <span className="flex items-center gap-1.5"><Users size={14} /> Staff Accounts</span>
                  <span className="font-bold text-gray-800">
                    {usage?.staffAccounts || 0} / {limits?.maxStaffAccounts === null ? 'Unlimited' : limits?.maxStaffAccounts}
                  </span>
                </div>
                {limits?.maxStaffAccounts !== null ? (
                  <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full ${getCapacityColor(usage?.staffAccounts || 0, limits?.maxStaffAccounts)} transition-all`}
                      style={{ width: `${calcPercent(usage?.staffAccounts || 0, limits?.maxStaffAccounts)}%` }}
                    />
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-600 font-bold mt-2">Unlimited staff</div>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Waiters & kitchen users (Owner excluded)
              </p>
            </div>

            {/* Locations */}
            <div className="p-5 rounded-2xl bg-gray-50/80 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-gray-500 text-xs font-semibold mb-2">
                  <span className="flex items-center gap-1.5"><Building2 size={14} /> Locations</span>
                  <span className="font-bold text-gray-800">
                    {usage?.locations || 1} / {limits?.maxLocations}
                  </span>
                </div>
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-3">
                  <div 
                    className={`h-full ${getCapacityColor(usage?.locations || 1, limits?.maxLocations)} transition-all`}
                    style={{ width: `${calcPercent(usage?.locations || 1, limits?.maxLocations)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                {limits?.maxLocations > 1 ? 'Multi-branch enabled' : 'Single location'}
              </p>
            </div>
          </div>
        </div>

        {/* Enabled & Locked Features */}
        <div className="p-6 md:p-8 border-t border-gray-100 bg-gray-50/30">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Included Plan Entitlements</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {subscription.displayFeatures?.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-200/60 font-medium text-gray-800">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade / Change Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 font-serif">Select Destination Plan</h3>
                <p className="text-xs text-gray-500">Choose plan and billing cycle</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-xl">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              {/* Billing Cycle Toggle */}
              <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 py-2 rounded-xl transition-all ${
                    billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`flex-1 py-2 rounded-xl transition-all ${
                    billingCycle === 'yearly' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500'
                  }`}
                >
                  Annual Billing (Save 16.7%)
                </button>
              </div>

              {/* Plans Radio Grid */}
              <div className="space-y-2.5">
                {planOptions.map((opt) => {
                  const price = billingCycle === 'yearly' ? opt.yearlyPrice : opt.monthlyPrice;
                  const isSelected = selectedPlan === opt.id;

                  return (
                    <div
                      key={opt.id}
                      onClick={() => setSelectedPlan(opt.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">{opt.name}</span>
                          {opt.popular && (
                            <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.limitsText}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold text-gray-900 font-serif">
                          ₹{price.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-gray-400">
                          {billingCycle === 'yearly' ? '/year' : '/month'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-xs text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePlanChangeRequest}
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
