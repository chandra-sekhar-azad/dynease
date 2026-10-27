import React, { useState, useEffect } from 'react';
import { 
  Check, X, Sparkles, Zap, Crown, Building2, Utensils, 
  HelpCircle, ArrowRight, ShieldCheck, ChevronDown, ChevronUp 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [showComparison, setShowComparison] = useState(true);

  // Fallback canonical plans matching the exact backend configuration
  const fallbackPlans = [
    {
      planId: 'STARTER',
      name: 'Starter',
      tagline: 'Ideal for small cafes & bistros starting their digital journey',
      monthlyDisplayPrice: 999,
      yearlyDisplayPrice: 9999,
      savingsRupees: 1989,
      discountPercent: 16.7,
      badge: null,
      isPopular: false,
      limits: {
        maxLocations: 1,
        maxTables: 5,
        maxMenuItems: 50,
        maxStaffAccounts: 3,
        orderHistoryDays: 7
      },
      features: {
        qrOrdering: true,
        liveOrders: true,
        salesAnalytics: 'basic',
        customerReviews: true,
        showAds: true,
        restaurantBranding: 'basic',
        customerCrm: 'none',
        reportsExport: false,
        multiLocationDashboard: false,
        loyaltySystem: false,
        supportLevel: 'standard'
      },
      displayFeatures: [
        '1 Restaurant location',
        'Up to 5 Tables',
        'Up to 50 Active menu items',
        'QR ordering & live orders',
        '3 Staff accounts',
        '7 days Order history',
        'Basic Sales analytics',
        'Customer reviews',
        'Basic restaurant branding',
        'Standard support'
      ]
    },
    {
      planId: 'GROWTH',
      name: 'Growth',
      tagline: 'Best for growing dine-in restaurants needing expanded capacity',
      monthlyDisplayPrice: 1999,
      yearlyDisplayPrice: 19999,
      savingsRupees: 3989,
      discountPercent: 16.7,
      badge: 'Most Popular',
      isPopular: true,
      limits: {
        maxLocations: 1,
        maxTables: 20,
        maxMenuItems: 200,
        maxStaffAccounts: 10,
        orderHistoryDays: 30
      },
      features: {
        qrOrdering: true,
        liveOrders: true,
        salesAnalytics: 'advanced',
        customerReviews: true,
        showAds: true,
        restaurantBranding: 'customizable',
        customerCrm: 'basic',
        reportsExport: false,
        multiLocationDashboard: false,
        loyaltySystem: false,
        supportLevel: 'priority'
      },
      displayFeatures: [
        '1 Restaurant location',
        'Up to 20 Tables',
        'Up to 200 Active menu items',
        'QR ordering & live orders',
        '10 Staff accounts',
        '30 days Order history',
        'Advanced Sales analytics',
        'Customer reviews',
        'Customizable branding',
        'Basic Customer CRM',
        'Priority support'
      ]
    },
    {
      planId: 'BUSINESS',
      name: 'Business',
      tagline: 'Perfect for established multi-table and multi-outlet food businesses',
      monthlyDisplayPrice: 3499,
      yearlyDisplayPrice: 34999,
      savingsRupees: 6989,
      discountPercent: 16.7,
      badge: 'Best for Multi-Location',
      isPopular: false,
      limits: {
        maxLocations: 3,
        maxTables: 40,
        maxMenuItems: null,
        maxStaffAccounts: 30,
        orderHistoryDays: 365
      },
      features: {
        qrOrdering: true,
        liveOrders: true,
        salesAnalytics: 'advanced',
        customerReviews: true,
        showAds: true,
        restaurantBranding: 'customizable',
        customerCrm: 'full',
        reportsExport: true,
        multiLocationDashboard: true,
        loyaltySystem: false,
        supportLevel: 'priority'
      },
      displayFeatures: [
        'Up to 3 Restaurant locations',
        'Up to 40 Tables',
        'Unlimited Menu items',
        'QR ordering & live orders',
        '30 Staff accounts',
        '1 year Order history',
        'Advanced Sales analytics',
        'Customer reviews',
        'Customizable branding',
        'Full Customer CRM',
        'Reports export (CSV/Excel)',
        'Multi-location dashboard',
        'Priority support'
      ]
    },
    {
      planId: 'CUSTOM',
      name: 'Custom',
      tagline: 'Enterprise-grade platform tailored for restaurant chains and franchises',
      monthlyDisplayPrice: 'Custom',
      yearlyDisplayPrice: 'Custom',
      savingsRupees: 0,
      discountPercent: 16.7,
      badge: 'Enterprise & Chains',
      isPopular: false,
      isCustom: true,
      limits: {
        maxLocations: null,
        maxTables: null,
        maxMenuItems: null,
        maxStaffAccounts: null,
        orderHistoryDays: null
      },
      features: {
        qrOrdering: true,
        liveOrders: true,
        salesAnalytics: 'consolidated',
        customerReviews: true,
        showAds: false,
        restaurantBranding: 'advanced',
        customerCrm: 'loyalty',
        reportsExport: true,
        multiLocationDashboard: true,
        loyaltySystem: true,
        supportLevel: 'priority_onboarding'
      },
      displayFeatures: [
        'Unlimited Restaurant locations',
        'Unlimited Tables',
        'Unlimited Menu items',
        'QR ordering & live orders',
        'Unlimited Staff accounts',
        'Unlimited Order history',
        'Advanced + Consolidated analytics',
        'Customer reviews',
        'Advanced restaurant branding',
        'Full CRM + Loyalty rewards',
        'Reports export (CSV/Excel)',
        'Multi-location dashboard',
        'Priority support + dedicated onboarding'
      ]
    }
  ];

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/plans`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.plans) && data.data.plans.length > 0) {
        setPlans(data.data.plans);
      } else {
        setPlans(fallbackPlans);
      }
    } catch {
      // In case server is offline or proxying, safely render fallback plans
      setPlans(fallbackPlans);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanVisuals = (planId) => {
    switch (planId) {
      case 'STARTER':
        return {
          icon: <Utensils className="text-emerald-600" size={24} />,
          borderStyle: 'border-gray-200 hover:border-emerald-300',
          btnStyle: 'bg-gray-900 hover:bg-black text-white',
          checkColor: 'text-emerald-500'
        };
      case 'GROWTH':
        return {
          icon: <Zap className="text-white" size={24} />,
          borderStyle: 'border-emerald-500 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500',
          btnStyle: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30',
          checkColor: 'text-emerald-600'
        };
      case 'BUSINESS':
        return {
          icon: <Building2 className="text-indigo-600" size={24} />,
          borderStyle: 'border-gray-200 hover:border-indigo-300',
          btnStyle: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          checkColor: 'text-indigo-600'
        };
      case 'CUSTOM':
      case 'PRO':
        return {
          icon: <Crown className="text-amber-500" size={24} />,
          borderStyle: 'border-amber-300 hover:border-amber-400 shadow-lg shadow-amber-500/5',
          btnStyle: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-md shadow-orange-500/20',
          checkColor: 'text-amber-500'
        };
      default:
        return {
          icon: <Sparkles className="text-gray-600" size={24} />,
          borderStyle: 'border-gray-200',
          btnStyle: 'bg-gray-900 text-white',
          checkColor: 'text-emerald-500'
        };
    }
  };

  const formatLimit = (val) => (val === null ? 'Unlimited' : val);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0fdf4] via-[#f8fafc] to-white font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-emerald-100/40 via-transparent to-transparent -z-10 pointer-events-none" />
      <div className="absolute top-20 right-[-10%] w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute top-96 left-[-10%] w-[450px] h-[450px] bg-indigo-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      <Navbar />

      {/* Hero Header */}
      <div className="pt-32 pb-10 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 font-semibold text-xs sm:text-sm mb-6 shadow-xs">
          <Sparkles size={16} className="text-emerald-600" />
          <span>Simple, Scalable & Transparent Pricing</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight font-serif mb-6">
          Plans built for every stage of your restaurant
        </h1>

        <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto font-medium leading-relaxed mb-10">
          From neighborhood cafes to high-volume multi-location chains. Choose the right plan to digitize ordering, accelerate service, and boost dining revenue.
        </p>

        {/* Monthly / Yearly Billing Toggle */}
        <div className="flex flex-col sm:inline-flex sm:flex-row items-center bg-gray-100/90 p-1.5 rounded-2xl border border-gray-200 shadow-inner w-full sm:w-auto gap-1">
          <button
            type="button"
            id="billing-toggle-monthly"
            onClick={() => setBillingCycle('monthly')}
            className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-emerald-600 text-white shadow-md ring-1 ring-black/5'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            id="billing-toggle-yearly"
            onClick={() => setBillingCycle('yearly')}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              billingCycle === 'yearly'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Annual Billing</span>
            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
              billingCycle === 'yearly'
                ? 'bg-white/20 text-white'
                : 'bg-emerald-100 text-emerald-800 font-extrabold'
            }`}>
              Save 16.7%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch pt-4">
          {plans.map((tier) => {
            const visual = getPlanVisuals(tier.planId);
            const isCustomPlan = tier.isCustom || tier.planId === 'CUSTOM' || tier.monthlyPricePaise === null || typeof (billingCycle === 'monthly' ? tier.monthlyDisplayPrice : tier.yearlyDisplayPrice) !== 'number';
            const price = billingCycle === 'monthly' ? tier.monthlyDisplayPrice : tier.yearlyDisplayPrice;
            const period = billingCycle === 'monthly' ? '/month' : '/year';

            return (
              <div
                key={tier.planId}
                id={`pricing-card-${tier.planId.toLowerCase()}`}
                className={`rounded-3xl flex flex-col relative transition-all duration-300 hover:shadow-2xl border bg-white ${
                  visual.borderStyle
                } ${tier.isPopular ? 'scale-[1.02] md:scale-105 z-20' : ''}`}
              >
                {/* Popular Badge */}
                {tier.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
                    <span className="bg-emerald-600 text-white text-[11px] font-extrabold uppercase tracking-widest py-1 px-4 rounded-full shadow-lg shadow-emerald-600/30">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6 sm:p-7 flex-1 flex flex-col text-gray-900">
                  {/* Title & Icon Header */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold tracking-tight text-gray-900">{tier.name}</h3>
                    <div className="p-2 rounded-xl bg-gray-50 border border-gray-100">
                      {visual.icon}
                    </div>
                  </div>

                  <p className="text-xs mb-6 min-h-[36px] text-gray-500">
                    {tier.tagline}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline mb-1">
                    {!isCustomPlan ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-extrabold tracking-tight font-serif text-gray-900">
                          ₹{Number(price).toLocaleString('en-IN')}
                        </span>
                        <span className="ml-1.5 text-xs font-semibold text-gray-500">
                          {period}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-serif text-gray-900">
                        Custom Pricing
                      </span>
                    )}
                  </div>

                  {/* Savings / Billing Subtext */}
                  <div className="min-h-[24px] mb-6">
                    {!isCustomPlan ? (
                      billingCycle === 'yearly' ? (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          Save ₹{(tier.savingsRupees || 0).toLocaleString('en-IN')}/year (~{tier.discountPercent}%)
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          Billed monthly, cancel anytime
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-gray-500 font-medium">
                        Tailored pricing based on requirements
                      </span>
                    )}
                  </div>

                  {/* CTA Button */}
                  {isCustomPlan ? (
                    <a
                      href="tel:+918897536435"
                      className={`w-full text-center py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${visual.btnStyle}`}
                    >
                      <span>Talk to Sales</span>
                      <ArrowRight size={16} />
                    </a>
                  ) : (
                    <Link
                      to={`/register?plan=${tier.planId}&cycle=${billingCycle}`}
                      className={`w-full text-center py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${visual.btnStyle}`}
                    >
                      <span>{tier.isPopular ? 'Choose Growth' : `Get Started with ${tier.name}`}</span>
                      <ArrowRight size={16} />
                    </Link>
                  )}

                  {/* Features List */}
                  <div className="mt-6 pt-6 border-t border-gray-100 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider mb-4 text-gray-400">
                      Plan Highlights
                    </p>
                    <ul className="space-y-3">
                      {tier.displayFeatures.map((feat, idx) => (
                        <li key={idx} className="flex items-start text-xs font-medium">
                          <Check className={`h-4 w-4 shrink-0 mr-2.5 mt-0.5 ${visual.checkColor}`} />
                          <span className="text-gray-700 font-medium">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan Feature Comparison Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 relative z-10">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div 
            onClick={() => setShowComparison(!showComparison)}
            className="p-6 md:p-8 flex items-center justify-between cursor-pointer border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
          >
            <div>
              <h2 className="text-2xl font-bold font-serif text-gray-900">
                Detailed Plan Comparison
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Compare limits, analytics, CRM, and multi-location features side-by-side.
              </p>
            </div>
            <button className="p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
              {showComparison ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {showComparison && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-6 w-1/3">Feature</th>
                    <th className="py-4 px-4 text-center">Starter</th>
                    <th className="py-4 px-4 text-center bg-emerald-50/50 text-emerald-900">Growth</th>
                    <th className="py-4 px-4 text-center">Business</th>
                    <th className="py-4 px-4 text-center">Custom</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {/* Pricing Overview Section */}
                  <tr className="bg-gray-100/60 font-bold text-gray-900 text-xs">
                    <td colSpan="5" className="py-2.5 px-6 uppercase tracking-wider text-[11px]">Pricing Structure</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-semibold text-gray-900">Monthly Price</td>
                    <td className="py-3.5 px-4 text-center font-bold">₹999</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold text-emerald-700">₹1,999</td>
                    <td className="py-3.5 px-4 text-center font-bold">₹3,499</td>
                    <td className="py-3.5 px-4 text-center font-bold text-amber-600">Custom pricing</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-semibold text-gray-900">Yearly Price</td>
                    <td className="py-3.5 px-4 text-center font-bold">₹9,999</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold text-emerald-700">₹19,999</td>
                    <td className="py-3.5 px-4 text-center font-bold">₹34,999</td>
                    <td className="py-3.5 px-4 text-center font-bold text-amber-600">Custom pricing</td>
                  </tr>

                  {/* Limits Section */}
                  <tr className="bg-gray-100/60 font-bold text-gray-900 text-xs">
                    <td colSpan="5" className="py-2.5 px-6 uppercase tracking-wider text-[11px]">Core Capacities & Limits</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-semibold text-gray-900">Total Tables (Active registered)</td>
                    <td className="py-3.5 px-4 text-center font-bold">5</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold text-emerald-700">20</td>
                    <td className="py-3.5 px-4 text-center font-bold">40</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-semibold text-gray-900">Menu Items (Active)</td>
                    <td className="py-3.5 px-4 text-center">50</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">200</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Unlimited</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-semibold text-gray-900">Staff Accounts (Waiters / Kitchen)</td>
                    <td className="py-3.5 px-4 text-center">3</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">10</td>
                    <td className="py-3.5 px-4 text-center font-bold">30</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6 font-semibold text-gray-900">Order History Retention</td>
                    <td className="py-3.5 px-4 text-center">7 days</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">30 days</td>
                    <td className="py-3.5 px-4 text-center font-bold">1 year</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Unlimited</td>
                  </tr>

                  {/* Capabilities Section */}
                  <tr className="bg-gray-100/60 font-bold text-gray-900 text-xs">
                    <td colSpan="5" className="py-2.5 px-6 uppercase tracking-wider text-[11px]">Ordering & Service Features</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">QR Code Ordering & Live Orders</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Customer Reviews & Ratings</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Ads on Customer Menu</td>
                    <td className="py-3.5 px-4 text-center font-bold">Yes</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">Yes</td>
                    <td className="py-3.5 px-4 text-center font-bold">Yes</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">No (Ad-free)</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Sales Analytics</td>
                    <td className="py-3.5 px-4 text-center">Basic</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">Advanced</td>
                    <td className="py-3.5 px-4 text-center font-bold">Advanced</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Advanced + Consolidated</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Restaurant Branding</td>
                    <td className="py-3.5 px-4 text-center">Basic</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">Customizable</td>
                    <td className="py-3.5 px-4 text-center font-bold">Customizable</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Advanced</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Customer CRM</td>
                    <td className="py-3.5 px-4 text-center text-gray-400">Not included</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">Basic</td>
                    <td className="py-3.5 px-4 text-center font-bold">Full CRM</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Full CRM + Loyalty</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Reports Export (CSV / Excel)</td>
                    <td className="py-3.5 px-4 text-center text-gray-400">Not included</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 text-gray-400">Not included</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">Included</td>
                  </tr>
                  <tr>
                    <td className="py-3.5 px-6">Priority Support</td>
                    <td className="py-3.5 px-4 text-center">Standard</td>
                    <td className="py-3.5 px-4 text-center bg-emerald-50/30 font-bold">Priority</td>
                    <td className="py-3.5 px-4 text-center font-bold">Priority</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600">Priority + Onboarding</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
