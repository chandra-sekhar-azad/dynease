import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function RestaurantDashboard() {
  const [restaurantName, setRestaurantName] = useState('Loading...');
  const [stats, setStats] = useState({ todaysOrders: 0, revenue: 0, activeTables: 0 });
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch User
        const userRes = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, { headers });
        const userData = await userRes.json();
        if (userData.success && userData.data.user?.restaurantId) {
          setRestaurantName(userData.data.user.restaurantId.name);
        }

        // Fetch Stats
        const statsRes = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/stats`, { headers });
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        }

        // Fetch Subscription
        const subRes = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/subscription`, { headers });
        const subData = await subRes.json();
        if (subData.success) {
          setSubscription(subData.data);
        }

      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const getSubAlert = () => {
    if (!subscription) return null;
    const { status, remainingDays } = subscription;

    if (subscription.renewalRequest && subscription.renewalRequest.status === 'PENDING') {
      return (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="shrink-0 mt-0.5 text-blue-600" size={20} />
            <div>
              <h4 className="font-bold text-sm">Renewal Request Pending</h4>
              <p className="text-xs text-blue-700 mt-0.5">Your request to renew/upgrade to the {subscription.renewalRequest.plan} plan is being reviewed by the admin.</p>
            </div>
          </div>
          <Link
            to="/restaurant/subscription"
            className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg shrink-0 hover:bg-blue-700 transition-colors"
          >
            View Status
          </Link>
        </div>
      );
    }

    if (status === 'EXPIRED') {
      return (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-center justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5 text-red-600" size={20} />
            <div>
              <h4 className="font-bold text-sm">Subscription Expired</h4>
              <p className="text-xs text-red-700 mt-0.5">Live table QR ordering is paused. Renew your subscription to accept customer orders.</p>
            </div>
          </div>
          <Link
            to="/restaurant/subscription"
            className="text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-lg shrink-0 hover:bg-red-700 transition-colors"
          >
            Renew Now
          </Link>
        </div>
      );
    }

    if (remainingDays === 1) {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5 text-amber-600" size={20} />
            <div>
              <h4 className="font-bold text-sm">Subscription Expiring Tomorrow!</h4>
              <p className="text-xs text-amber-700 mt-0.5">Your subscription expires tomorrow. Renew your plan to avoid interruption.</p>
            </div>
          </div>
          <Link
            to="/restaurant/subscription"
            className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg shrink-0 hover:bg-amber-700 transition-colors"
          >
            Renew
          </Link>
        </div>
      );
    }

    if (remainingDays <= 3) {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center justify-between gap-3 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="shrink-0 mt-0.5 text-amber-600" size={20} />
            <div>
              <h4 className="font-bold text-sm">Subscription Expires in {remainingDays} Days</h4>
              <p className="text-xs text-amber-700 mt-0.5">Renew now in the Subscription & Billing tab to continue uninterrupted service.</p>
            </div>
          </div>
          <Link
            to="/restaurant/subscription"
            className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg shrink-0 hover:bg-amber-700 transition-colors"
          >
            Renew Plan
          </Link>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto relative animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-serif text-gray-900 tracking-tight">
            Welcome to {restaurantName}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Here is an overview of your restaurant performance today.</p>
        </div>

        <Link
          to="/restaurant/orders"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200 transition-colors self-start sm:self-auto"
        >
          <span>Live Orders Panel</span>
          <ChevronRight size={14} />
        </Link>
      </div>
      
      {getSubAlert()}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 flex flex-col justify-center items-center h-32 hover:shadow-md transition-shadow">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Today's Orders</p>
          <h3 className="text-4xl font-extrabold text-emerald-600 mt-2">{stats.todaysOrders}</h3>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 flex flex-col justify-center items-center h-32 hover:shadow-md transition-shadow">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Revenue Today</p>
          <h3 className="text-4xl font-extrabold text-emerald-600 mt-2">₹{stats.revenue}</h3>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 flex flex-col justify-center items-center h-32 hover:shadow-md transition-shadow">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Active Tables</p>
          <h3 className="text-4xl font-extrabold text-blue-600 mt-2">{stats.activeTables}</h3>
        </div>
      </div>
    </div>
  );
}
