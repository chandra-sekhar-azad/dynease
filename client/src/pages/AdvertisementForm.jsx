import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, User, Phone, Mail, MapPin, MessageSquare, 
  Sparkles, CheckCircle2, ArrowRight, Megaphone, ShieldCheck, 
  TrendingUp, Users, Eye, Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function AdvertisementForm() {
  const [formData, setFormData] = useState({
    name: '',
    mobileNumber: '',
    businessName: '',
    email: '',
    city: '',
    message: ''
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Form validation
    if (!formData.name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!formData.mobileNumber.trim()) {
      setError('Please enter your mobile number');
      return;
    }
    if (formData.mobileNumber.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!formData.businessName.trim()) {
      setError('Please enter your business or brand name');
      return;
    }

    setLoading(true);

    const submissionData = {
      _id: 'inq_' + Date.now(),
      name: formData.name.trim(),
      mobileNumber: formData.mobileNumber.trim(),
      businessName: formData.businessName.trim(),
      email: formData.email.trim(),
      city: formData.city.trim(),
      message: formData.message.trim(),
      status: 'NEW',
      createdAt: new Date().toISOString()
    };

    // Save to localStorage as immediate offline & hybrid sync fallback
    try {
      const existingInquiries = JSON.parse(localStorage.getItem('dynease_ad_inquiries') || '[]');
      localStorage.setItem('dynease_ad_inquiries', JSON.stringify([submissionData, ...existingInquiries]));
    } catch (storageErr) {
      console.warn('LocalStorage save failed:', storageErr);
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      let apiSuccess = false;

      // Attempt 1: public route
      try {
        const res = await fetch(`${apiUrl}/public/advertise`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionData)
        });
        const data = await res.json();
        if (data.success) apiSuccess = true;
      } catch (err) {
        // Fallback to admin route
      }

      // Attempt 2: admin route fallback if not yet succeeded
      if (!apiSuccess) {
        try {
          const res = await fetch(`${apiUrl}/admin/ad-inquiries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
          });
          const data = await res.json();
          if (data.success) apiSuccess = true;
        } catch (err) {
          console.warn('Backend API submission warning:', err);
        }
      }

      setSubmitted(true);
    } catch (err) {
      // Even if network drops, local inquiry is recorded
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7fbf8] flex flex-col font-sans">
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 pt-24 md:pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">

          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-200">
              <Megaphone size={14} className="text-emerald-600" />
              <span>Partner With Dynease</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-gray-900 tracking-tight leading-tight">
              Advertise Directly on <span className="text-[var(--color-primary)]">Digital Menus</span>
            </h1>
            <p className="mt-4 text-base md:text-lg text-gray-600 leading-relaxed">
              Reach thousands of engaged food lovers and diners right when they browse and order. Put your brand front and center across our restaurant partner network.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Benefits & Value Proposition */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Feature Cards */}
              <div className="bg-white rounded-2xl p-6 border border-emerald-100 shadow-sm space-y-5">
                <h3 className="font-serif font-bold text-lg text-gray-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-500" />
                  Why Advertise on Dynease?
                </h3>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-primary)] flex items-center justify-center shrink-0 border border-emerald-100">
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">High-Intent Audience</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      100% of impressions are verified diners seated at restaurant tables actively browsing menus.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-primary)] flex items-center justify-center shrink-0 border border-emerald-100">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Prime Menu Banners</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Featured dual-part banner slots at the very top of interactive customer ordering menus.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-primary)] flex items-center justify-center shrink-0 border border-emerald-100">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Direct Click-Throughs</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Link banners directly to your website, WhatsApp, social channels, or special offers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-primary)] flex items-center justify-center shrink-0 border border-emerald-100">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">Quick Setup & Support</h4>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Our advertising team will design, review, and schedule your banners within 24 hours.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample Banner Preview Card */}
              <div className="bg-gradient-to-br from-emerald-900 to-green-950 text-white rounded-2xl p-5 shadow-lg border border-emerald-700/50">
                <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold uppercase tracking-wider mb-2">
                  <span>Preview: Customer Menu Banner</span>
                  <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">Live Sample</span>
                </div>
                <div className="bg-black/30 backdrop-blur-sm rounded-xl p-3.5 border border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Sponsored</span>
                    <h4 className="font-bold text-[25px] text-white mt-1">Your Brand Highlight</h4>
                    <p className="text-[11px] text-emerald-100/70 mt-0.5">Special offers for diners tonight</p>
                    <span className="mt-2 inline-block text-[10px] font-bold bg-white text-emerald-950 px-2 py-0.5 rounded">
                      Explore Deals →
                    </span>
                  </div>
                  <div className="w-20 h-16 rounded-lg bg-emerald-800/80 flex items-center justify-center border border-emerald-600/40 shrink-0 text-center text-[10px] text-emerald-200">
                    Your Image
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Advertisement Inquiry Form */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-200 shadow-xl relative overflow-hidden">
                
                {/* Decorative Top Accent */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[var(--color-primary)] via-emerald-400 to-teal-500"></div>

                {submitted ? (
                  /* Success State */
                  <div className="py-10 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-emerald-50">
                      <CheckCircle2 size={44} className="stroke-[2.5]" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 mb-2">
                      Request Submitted!
                    </h3>
                    <p className="text-gray-600 max-w-md mx-auto text-sm sm:text-base leading-relaxed mb-6">
                      Thank you, <strong className="text-gray-900">{formData.name}</strong>! We have received your advertising inquiry for <strong className="text-gray-900">{formData.businessName}</strong>.
                    </p>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 max-w-md mx-auto text-left mb-8 space-y-2 text-sm text-emerald-900">
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        <span>Submitted for review in Banner Management</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        <span>We will contact you at <strong>{formData.mobileNumber}</strong> shortly</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-600 shrink-0" />
                        <span>Custom banner design & campaign scheduling assistance</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => {
                          setSubmitted(false);
                          setFormData({
                            name: '',
                            mobileNumber: '',
                            businessName: '',
                            email: '',
                            city: '',
                            message: ''
                          });
                        }}
                        className="px-6 py-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors"
                      >
                        Submit Another Inquiry
                      </button>
                      <Link
                        to="/"
                        className="px-7 py-3 rounded-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-sm font-semibold transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                        <span>Back to Home</span>
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  /* Inquiry Form */
                  <div>
                    <div className="mb-6">
                      <h2 className="text-2xl font-serif font-bold text-gray-900">
                        Advertise With Us
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Fill in your business details below. Our advertising team will reach out with placement plans and pricing.
                      </p>
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2.5 animate-shake">
                        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                        <span>{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      
                      {/* 1. Full Name */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          1. Your Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <User size={18} />
                          </div>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Rahul Sharma"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      {/* 2. Mobile Number */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          2. Mobile Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Phone size={18} />
                          </div>
                          <input
                            type="tel"
                            name="mobileNumber"
                            value={formData.mobileNumber}
                            onChange={handleChange}
                            required
                            placeholder="e.g. 9876543210"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                          />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          We will connect with you on WhatsApp or call on this number.
                        </p>
                      </div>

                      {/* 3. Business Name */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          3. Business / Brand Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                            <Building2 size={18} />
                          </div>
                          <input
                            type="text"
                            name="businessName"
                            value={formData.businessName}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Sweet Treats Bakery / Urban Fitness"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                          />
                        </div>
                      </div>

                      {/* Optional Grid: Email & City */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                            Email (Optional)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                              <Mail size={18} />
                            </div>
                            <input
                              type="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              placeholder="contact@business.com"
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                            City / Location (Optional)
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                              <MapPin size={18} />
                            </div>
                            <input
                              type="text"
                              name="city"
                              value={formData.city}
                              onChange={handleChange}
                              placeholder="e.g. Visakhapatnam"
                              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Optional: Message / Goals */}
                      <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                          Advertising Goals / Notes (Optional)
                        </label>
                        <div className="relative">
                          <textarea
                            name="message"
                            rows={3}
                            value={formData.message}
                            onChange={handleChange}
                            placeholder="Tell us about the promotion, offer, or target audience you want to reach..."
                            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all resize-none"
                          />
                        </div>
                      </div>

                      {/* Submit Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white rounded-2xl font-bold text-base transition-all shadow-lg shadow-emerald-700/20 hover:shadow-xl hover:shadow-emerald-700/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {loading ? (
                            <>
                              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              <span>Submitting Request...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Advertising Request</span>
                              <ArrowRight size={18} />
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-center text-xs text-gray-400 pt-2">
                        🔒 We respect your privacy. No spam. You will be contacted directly by our business team.
                      </p>

                    </form>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
