import React, { useState } from 'react';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

  const tiers = [
    {
      name: 'GROWTH',
      monthlyPrice: '₹1499',
      yearlyPrice: '₹11999',
      period: billingCycle === 'monthly' ? '/mo' : '/yr',
      subtext: billingCycle === 'yearly' ? '₹1,000/mo billed annually (Save 33%)' : 'Billed monthly',
      popular: true,
      icon: <Zap className="text-orange-100" size={24} />,
      description: 'MOST POPULAR',
      features: [
        '1 Restaurant',
        'Unlimited Tables',
        'Unlimited Menu Items',
        'Live Orders',
        'Staff Accounts',
        'Advanced Analytics',
        'Customer Reviews',
        'Platform Branding'
      ],
      buttonText: 'Choose Growth',
      cardStyle: 'bg-gradient-to-b from-orange-500 to-red-600 text-white shadow-2xl shadow-orange-500/40 transform md:-translate-y-2 border-none scale-100 md:scale-105',
      buttonStyle: 'bg-white text-orange-600 hover:bg-gray-50',
      checkColor: 'text-orange-200',
      featureText: 'text-white/90'
    },
    {
      name: 'PRO',
      monthlyPrice: '₹2499',
      yearlyPrice: '₹23999',
      period: billingCycle === 'monthly' ? '/mo' : '/yr',
      subtext: billingCycle === 'yearly' ? '₹2,000/mo billed annually (Save 20%)' : 'Billed monthly',
      icon: <Crown className="text-yellow-500" size={24} />,
      description: 'FOR GROWING RESTAURANTS',
      features: [
        'Everything in Growth',
        'Multiple Branches',
        'Multiple Kitchens',
        'Customer CRM',
        'Loyalty System',
        'Advanced Reports',
        'Custom Branding',
        'Custom Domain',
        'Priority Support'
      ],
      buttonText: 'GO PRO',
      cardStyle: 'bg-slate-900 text-white border border-slate-700 shadow-xl shadow-slate-900/20',
      buttonStyle: 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700',
      checkColor: 'text-yellow-500',
      featureText: 'text-slate-300'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eafaf0] via-[#f7fdf9] to-white font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-orange-100/50 to-transparent -z-10 pointer-events-none"></div>
      <div className="absolute top-40 right-[-10%] w-96 h-96 bg-orange-300/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute top-80 left-[-10%] w-72 h-72 bg-red-300/20 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <Navbar />
      
      {/* Header Section */}
      <div className="pt-32 pb-8 px-4 sm:px-6 lg:px-8 text-center max-w-7xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-700 font-medium text-sm mb-6">
          <Sparkles size={16} /> Transparent Pricing, No Hidden Fees
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl lg:text-6xl tracking-tight mb-6">
          Choose Your Plan
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium mb-8">
          Whether you're just starting out or managing multiple locations, we have the right tools to digitize your restaurant.
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="inline-flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              billingCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow-md'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              billingCycle === 'yearly'
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Yearly</span>
            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
              billingCycle === 'yearly'
                ? 'bg-white/20 text-white'
                : 'bg-green-100 text-green-700'
            }`}>
              Save up to 33%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pt-8">
          {tiers.map((tier) => (
            <div 
              key={tier.name}
              className={`rounded-3xl flex flex-col relative transition-all duration-300 hover:shadow-2xl ${tier.cardStyle}`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold uppercase tracking-widest py-1.5 px-5 rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold tracking-tight">{tier.name}</h3>
                  {tier.icon}
                </div>
                
                <p className={`text-xs font-bold uppercase tracking-wider mb-6 h-4 ${tier.popular ? 'text-white/80' : 'text-gray-400'}`}>
                  {tier.description}
                </p>
                
                <div className="flex items-baseline mb-2">
                  <span className="text-5xl font-extrabold tracking-tight">
                    {billingCycle === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice}
                  </span>
                  <span className={`ml-2 font-medium ${tier.popular ? 'text-white/80' : 'text-gray-500'}`}>
                    {tier.period}
                  </span>
                </div>
                <div className="mb-8 min-h-[20px]">
                  <span className={`text-xs font-medium ${tier.popular ? 'text-white/80' : 'text-gray-500'}`}>
                    {tier.subtext}
                  </span>
                </div>
                
                <Link to={`/register?plan=${tier.name}&cycle=${billingCycle}`} className={`w-full text-center py-3.5 px-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${tier.buttonStyle}`}>
                  {tier.buttonText}
                  <span className="text-lg leading-none">→</span>
                </Link>

                <div className={`mt-8 pt-8 border-t ${tier.popular ? 'border-white/20' : 'border-gray-100'} flex-1`}>
                  <ul className="space-y-4">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <Check className={`h-5 w-5 ${tier.checkColor}`} />
                        </div>
                        <p className={`ml-3 text-base font-medium ${tier.featureText}`}>{feature}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trial Banner */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-10">
        <div className="bg-gradient-to-br from-[var(--color-primary)] to-[#156d3c] rounded-3xl p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl overflow-hidden relative">
          
          {/* Subtle bg decor */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          
          <div className="flex-1 relative z-10 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 text-white font-bold mb-4 bg-white/20 px-4 py-1.5 rounded-full text-sm">
              <Sparkles size={18} />
              <span>14-DAY FREE TRIAL</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Experience the platform free. <br className="hidden md:block" /> No credit card required.
            </h3>
            
            <div className="flex flex-col md:flex-row items-center justify-center lg:justify-start gap-3 text-sm text-green-100 mt-6 font-medium bg-black/10 p-4 rounded-xl inline-flex w-full md:w-auto">
              <span>Start your restaurant</span>
              <span className="hidden md:block text-white/40">→</span>
              <span>Add your menu</span>
              <span className="hidden md:block text-white/40">→</span>
              <span>Get QR codes</span>
              <span className="hidden md:block text-white/40">→</span>
              <span className="text-white">Receive orders</span>
            </div>
          </div>
          
          <div className="relative z-10 shrink-0 w-full lg:w-auto text-center">
            <Link to="/register" className="inline-block w-full lg:w-auto bg-white hover:bg-gray-50 text-[var(--color-primary)] font-bold text-lg py-4 px-10 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all transform hover:-translate-y-1">
              Start Your Trial
            </Link>
            <p className="text-sm text-green-200 mt-4 italic">
              * Choose Growth or Pro after 14 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
