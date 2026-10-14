import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, Check, ArrowRight,
  ScanLine, ListTree, ShoppingCart, Smile,
  FileText, Columns, Zap, Users, Monitor, BarChart2,
  CheckCircle2, Sparkles, Printer, Smartphone, TrendingUp, RotateCw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

import heroMockup from '../assets/hero-mockup.png';
import paneerTikkaImg from '../assets/starters/paneer thikka.png';
import chicken65Img from '../assets/starters/Chicken 65.jpg';
import vegSpringRollsImg from '../assets/starters/Veg Spring Rolls.jpg';
import fishFingersImg from '../assets/starters/Fish fingers.png';
import muttonBiryaniImg from '../assets/biriyani/Mutton Biryani.jpg';
import garlicNaanImg from '../assets/starters/Garlic Naan.jpg';
import chickenHotSourImg from '../assets/soups/Chicken Hot & Sour Soup.jpg';
import chickenManchowImg from '../assets/soups/Chicken Manchow Soup.jpg';
import tomatoSoupImg from '../assets/soups/Tomato Soup.jpg';
import vegManchowImg from '../assets/soups/Veg Manchow Soup.jpg';
import chickenBiryaniComboImg from '../assets/biriyani/Chicken Biryani Combo.jpg';
import chickenDumBiryaniImg from '../assets/biriyani/Chicken Dum Biryani.jpg';
import paneerBiryaniImg from '../assets/biriyani/Paneer Biryani.jpg';
import vegDumBiryaniImg from '../assets/biriyani/Veg Dum Biryani.jpg';
import seafood1Img from '../assets/seafood/seafood1.png';
import seafood2Img from '../assets/seafood/seafood2.png';
import seafood3Img from '../assets/seafood/seafood3.png';
import iconImg from '../assets/icon.png';

const BENEFITS = [
  {
    id: 'printing-costs',
    title: 'Save on Printing Costs',
    userDesc: 'Eliminate repeated menu printing and reprinting with easy-to-update digital menus.',
    frontTeaser: 'Say goodbye to recurring paper printing expenses, worn-out menu cards, and costly laminate reprints.',
    category: 'Cost Efficiency',
    metric: 'Save ₹15,000+ / yr',
    icon: Printer,
    theme: {
      lightBg: 'bg-emerald-50',
      lightBorder: 'border-emerald-200',
      text: 'text-emerald-700',
      glow: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-600 text-white shadow-emerald-600/30',
      accentColor: '#059669',
    },
    highlights: [
      { bold: 'Instant Menu Updates:', text: 'Update prices or mark dishes out-of-stock in seconds without wasting paper.' },
      { bold: 'Zero Wastage:', text: 'No more discarding ripped, stained, or outdated physical menus.' },
      { bold: 'Seasonal Menus:', text: 'Launch festival specials, chef specials, and weekend menus at zero print cost.' }
    ],
    valueChip: 'Zero Paper Wastage'
  },
  {
    id: 'operational-efficiency',
    title: 'Improve Operational Efficiency',
    userDesc: 'Instant menu updates and digital ordering reduce manual work and streamline daily restaurant operations.',
    frontTeaser: 'Cut down order-taking bottlenecks, reduce waiter trips, and eliminate handwritten order mistakes.',
    category: 'Workflow & Speed',
    metric: '35% Faster Turns',
    icon: Zap,
    theme: {
      lightBg: 'bg-teal-50',
      lightBorder: 'border-teal-200',
      text: 'text-teal-700',
      glow: 'from-teal-500/15 via-teal-500/5 to-transparent',
      badge: 'bg-teal-50 text-teal-800 border-teal-200',
      iconBg: 'bg-teal-600 text-white shadow-teal-600/30',
      accentColor: '#0d9488',
    },
    highlights: [
      { bold: 'Direct-to-Kitchen Sync:', text: 'Orders route instantly to the kitchen display, eliminating ticket delays.' },
      { bold: 'Focus on Hospitality:', text: 'Waiters spend time attending guests instead of running pen-and-paper orders.' },
      { bold: 'Centralized Control:', text: 'Manage table statuses, live items, and customer bills in real time from one dashboard.' }
    ],
    valueChip: '2x Faster Order Flow'
  },
  {
    id: 'modern-dining',
    title: 'Deliver a Modern Dining Experience',
    userDesc: 'Offer customers a convenient, user-friendly digital menu and a seamless QR-based ordering experience.',
    frontTeaser: 'Delight tech-savvy diners with an intuitive, picture-rich digital menu right on their smartphones.',
    category: 'Guest Experience',
    metric: '4.9★ Guest Rating',
    icon: Smartphone,
    theme: {
      lightBg: 'bg-indigo-50',
      lightBorder: 'border-indigo-200',
      text: 'text-indigo-700',
      glow: 'from-indigo-500/15 via-indigo-500/5 to-transparent',
      badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      iconBg: 'bg-indigo-600 text-white shadow-indigo-600/30',
      accentColor: '#4f46e5',
    },
    highlights: [
      { bold: 'Zero Wait Times:', text: 'Guests scan the table QR code and browse immediately without waiting for menus.' },
      { bold: 'Rich Dish Visuals:', text: 'Showcase tempting photos, descriptions, dietary badges (Veg/Non-Veg), and allergen notes.' },
      { bold: 'Frictionless Browsing:', text: 'Smooth smartphone browser experience with zero app downloads or accounts required.' }
    ],
    valueChip: 'Loved by Diners'
  },
  {
    id: 'smart-promotions',
    title: 'Boost Sales with Smart Promotions',
    userDesc: 'Showcase combos, recommend add-ons, and highlight special offers to encourage additional purchases.',
    frontTeaser: 'Intelligently upsell appetizers, drink pairings, combos, and chef specials at the optimal moment.',
    category: 'Revenue Growth',
    metric: '+20-25% Avg Bill',
    icon: TrendingUp,
    theme: {
      lightBg: 'bg-amber-50',
      lightBorder: 'border-amber-200',
      text: 'text-amber-700',
      glow: 'from-amber-500/15 via-amber-500/5 to-transparent',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-500 text-white shadow-amber-500/30',
      accentColor: '#d97706',
    },
    highlights: [
      { bold: 'Automated Recommendations:', text: 'Suggest beverage pairings, sides, and desserts automatically during item selection.' },
      { bold: 'Combo Packages:', text: 'Feature high-margin combo meals prominently at the top of menu categories.' },
      { bold: 'Dynamic Specials:', text: 'Highlight chef recommendations and time-sensitive promotions that drive purchases.' }
    ],
    valueChip: '+20%+ Revenue Uplift'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [isLaunchingDemo, setIsLaunchingDemo] = useState(false);
  const [flippedCards, setFlippedCards] = useState({});
  const [allFlipped, setAllFlipped] = useState(false);

  const toggleFlipAll = () => {
    const nextState = !allFlipped;
    setAllFlipped(nextState);
    const updated = {};
    BENEFITS.forEach((b) => {
      updated[b.id] = nextState;
    });
    setFlippedCards(updated);
  };

  const toggleCardFlip = (id) => {
    setFlippedCards((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleWatchDemo = () => {
    if (isLaunchingDemo) return;
    setIsLaunchingDemo(true);
    navigate('/demo?tour=true');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-gradient-to-br from-[#eafaf0] via-[#f7fdf9] to-white">
        <Navbar />

        {/* Hero */}
        <section className="relative pt-16 md:pt-20 pb-2 md:pb-4 px-4 sm:px-6 lg:px-12 overflow-hidden">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12">
          <div className="z-10 self-start mt-10 md:mt-12">
            <p className="text-[var(--color-primary)] font-bold text-xs tracking-widest uppercase mb-4 md:mt-2">
              QR Ordering ◉ Digital Menu ◉  Smart Restaurants
            </p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-[1.1]">
              Modern Dining,<br />
              <span className="text-[var(--color-primary)]">Made Simple</span>
            </h1>
            <p className="text-lg text-gray-600 mb-10 max-w-lg leading-relaxed">
              Dynease helps restaurants go digital with QR ordering, online menus and real-time order management  for a better dining experience, every time.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-8 py-3.5 rounded-full font-medium text-base transition-colors flex items-center gap-2">
                Get Started Free <ArrowRight size={18} />
              </Link>
              <button 
                onClick={handleWatchDemo}
                disabled={isLaunchingDemo}
                className="bg-white border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[#f0fdf4] px-8 py-3.5 rounded-full font-medium text-base transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                aria-label="Watch interactive Dynease product demo"
              >
                <PlayCircle size={18} /> {isLaunchingDemo ? 'Opening Demo...' : 'Watch Demo'}
              </button>
            </div>
          </div>
          <div className="relative flex justify-center md:justify-end self-center mt-16 md:mt-8">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#f0fdf4] rounded-full blur-3xl opacity-60 -z-10 md:mt-4"></div>
            <InteractivePhoneMockup />
          </div>
        </div>
      </section>
      </div>

      {/* How It Works */}
      <section className="pt-4 pb-8 px-4 sm:px-6 lg:px-8 bg-[#f4faf6]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[var(--color-primary)] font-bold text-xs tracking-widest uppercase mb-2">HOW IT WORKS</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">From QR to Your Table</h2>
            <p className="text-gray-600">A simple 4-step process to get your food, faster.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative">
            <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 border-t-2 border-dashed border-[#bbf7d0] -z-10"></div>
            
            <StepCard icon={<ScanLine size={32} />} title="1. Scan QR" desc="Scan the QR code on your table with your phone." />
            <StepCard icon={<ListTree size={32} />} title="2. Choose Food" desc="Browse our digital menu and add items to cart." />
            <StepCard icon={<ShoppingCart size={32} />} title="3. Place Order" desc="Confirm your order and we'll take care of the rest." />
            <StepCard icon={<Smile size={32} />} title="4. Enjoy Your Meal" desc="Get real-time updates and enjoy your food!" />
          </div>
        </div>
      </section>

      {/* Benefits Section with 3D Flipping Cards */}
      <section id="benefits" className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#f4faf6] via-white to-white relative overflow-hidden">
        {/* Ambient background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-emerald-100/50 via-teal-50/30 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold tracking-widest uppercase mb-3 border border-emerald-200/60 shadow-2xs">
              <Sparkles size={14} className="text-emerald-600" />
              <span>KEY BENEFITS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight mb-4 leading-tight">
              Why Restaurants Choose <span className="text-[var(--color-primary)]">Dynease</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Empowering food businesses to eliminate printing overheads, accelerate kitchen workflows, and boost revenue with modern QR menus.
            </p>

            {/* Interactive hint & toggle */}
            <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 bg-white/95 backdrop-blur-sm border border-emerald-200/80 px-4 py-2 rounded-full shadow-xs text-xs sm:text-sm text-gray-600">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <RotateCw size={13} className="text-emerald-600" />
                <span>3D Interactive Cards</span>
              </span>
              <span className="text-gray-300 hidden sm:inline">•</span>
              <span className="text-gray-500">Hover or tap cards to flip</span>
              <span className="text-gray-300 hidden sm:inline">•</span>
              <button 
                type="button"
                onClick={toggleFlipAll}
                className="text-[var(--color-primary)] font-bold hover:underline cursor-pointer flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 transition-colors"
                aria-label="Toggle flip state for all cards"
              >
                <RotateCw size={12} className={allFlipped ? 'rotate-180 transition-transform' : 'transition-transform'} />
                <span>{allFlipped ? 'Flip Back to Front' : 'Flip All Cards'}</span>
              </button>
            </div>
          </div>

          {/* 4 Flipping Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-6 lg:gap-7 items-stretch">
            {BENEFITS.map((benefit) => (
              <BenefitFlipCard
                key={benefit.id}
                benefit={benefit}
                isFlipped={!!flippedCards[benefit.id]}
                onToggleFlip={() => toggleCardFlip(benefit.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-8 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[var(--color-primary)] font-bold text-xs tracking-widest uppercase mb-2">WHY DYNEASE</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">Everything You Need<br/>for a Smarter Restaurant</h2>
              <p className="text-gray-600 mb-10 text-lg">Powerful features designed to make ordering, managing and growing your restaurant easier than ever.</p>
              
              <div className="grid sm:grid-cols-2 gap-8">
                <FeatureItem icon={<FileText />} title="Digital Menu" desc="Showcase your menu with beautiful, easy-to-navigate categories." />
                <FeatureItem icon={<Columns />} title="Table Management" desc="Create tables, generate QR codes and manage seating easily." />
                <FeatureItem icon={<Zap />} title="Real-time Orders" desc="Get instant order notifications and updates." />
                <FeatureItem icon={<Users />} title="Staff Accounts" desc="Manage waiters, kitchen staff and permissions." />
                <FeatureItem icon={<Monitor />} title="Kitchen Display System" desc="Keep your kitchen in sync with live orders." />
                <FeatureItem icon={<BarChart2 />} title="Analytics & Reports" desc="Track sales, popular items and customer insights." />
              </div>
            </div>
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Restaurant Interior" className="w-full h-auto object-cover aspect-square" />
              </div>
              <div className="absolute top-1/2 -left-12 bg-white p-4 rounded-xl shadow-xl border border-gray-100 flex items-center gap-4">
                 <div className="bg-[#f0fdf4] p-3 rounded-lg text-[var(--color-primary)]">
                    <BarChart2 size={24} />
                 </div>
                 <div>
                    <p className="font-bold text-sm text-gray-900">Better Orders</p>
                    <p className="text-xs text-gray-500">Happier Customers</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 bg-[#f4faf6]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[var(--color-primary)] font-bold text-xs tracking-widest uppercase mb-2">SIMPLE & TRANSPARENT PRICING</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">Choose the Plan That Fits Your Restaurant</h2>
            
            {/* Monthly / Yearly Toggle */}
            <div className="inline-flex items-center bg-gray-200/80 p-1.5 rounded-2xl border border-gray-300/60 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                  billingCycle === 'yearly'
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>Yearly</span>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                  billingCycle === 'yearly'
                    ? 'bg-white/20 text-white'
                    : 'bg-green-100 text-green-700'
                }`}>
                  Save ~16.7% (2 Months Free)
                </span>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-stretch">
            {/* Starter Tier */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-all flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-gray-900">Starter</h3>
              <p className="text-xs text-gray-500 mb-4 min-h-[32px]">Ideal for small cafes & bistros starting digital ordering.</p>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {billingCycle === 'monthly' ? '₹999' : '₹9,999'}
                </span>
                <span className="text-xs text-gray-500 font-semibold">
                  {billingCycle === 'monthly' ? ' / mo' : ' / yr'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold mb-5 min-h-[20px]">
                {billingCycle === 'yearly' ? 'Save ₹1,989/yr (~16.7%)' : 'Billed monthly, cancel anytime'}
              </p>
              <ul className="space-y-3 mb-6 flex-1 text-xs text-gray-700 font-medium">
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>5</strong> Active tables</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>50</strong> Menu items</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>3</strong> Staff accounts</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>7 days</strong> Order history</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> QR ordering & live orders</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Basic sales totals</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Customer reviews</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Basic branding</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Standard support</li>
              </ul>
              <Link to={`/register?plan=STARTER&cycle=${billingCycle}`} className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold text-center transition-colors">
                Get Started
              </Link>
            </div>

            {/* Growth Tier (Most Popular) */}
            <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-emerald-500 flex flex-col relative transform md:-translate-y-2">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider py-1 px-3.5 rounded-full shadow-md">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-1 text-gray-900">Growth</h3>
              <p className="text-xs text-gray-500 mb-4 min-h-[32px]">Best for busy dine-in restaurants expanding table turnover.</p>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {billingCycle === 'monthly' ? '₹1,999' : '₹19,999'}
                </span>
                <span className="text-xs text-gray-500 font-semibold">
                  {billingCycle === 'monthly' ? ' / mo' : ' / yr'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold mb-5 min-h-[20px]">
                {billingCycle === 'yearly' ? 'Save ₹3,989/yr (~16.7%)' : 'Billed monthly, cancel anytime'}
              </p>
              <ul className="space-y-3 mb-6 flex-1 text-xs text-gray-700 font-medium">
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>20</strong> Active tables</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>200</strong> Menu items</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>10</strong> Staff accounts</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>30 days</strong> Order history</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> QR ordering & live orders</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Advanced sales trends</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Customer reviews</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Customizable branding</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Basic customer CRM</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Priority support</li>
              </ul>
              <Link to={`/register?plan=GROWTH&cycle=${billingCycle}`} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold text-center transition-colors shadow-md shadow-emerald-600/20">
                Choose Growth
              </Link>
            </div>

            {/* Business Tier */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-all flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-gray-900">Business</h3>
              <p className="text-xs text-gray-500 mb-4 min-h-[32px]">For established restaurants, multi-kitchens, and outlets.</p>
              <div className="mb-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {billingCycle === 'monthly' ? '₹3,499' : '₹34,999'}
                </span>
                <span className="text-xs text-gray-500 font-semibold">
                  {billingCycle === 'monthly' ? ' / mo' : ' / yr'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold mb-5 min-h-[20px]">
                {billingCycle === 'yearly' ? 'Save ₹6,989/yr (~16.7%)' : 'Billed monthly, cancel anytime'}
              </p>
              <ul className="space-y-3 mb-6 flex-1 text-xs text-gray-700 font-medium">
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>40</strong> Active tables</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>Unlimited</strong> Menu items</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>30</strong> Staff accounts</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> <strong>1 year</strong> Order history</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Advanced analytics</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Full customer CRM</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Reports export (CSV / Excel)</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Customizable branding</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Multi-outlet ready</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-emerald-600 shrink-0"/> Priority support</li>
              </ul>
              <Link to={`/register?plan=BUSINESS&cycle=${billingCycle}`} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition-colors">
                Choose Business
              </Link>
            </div>

            {/* Custom Tier */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-300 hover:shadow-lg transition-all flex flex-col">
              <h3 className="text-xl font-bold mb-1 text-gray-900">Custom</h3>
              <p className="text-xs text-gray-500 mb-4 min-h-[32px]">Enterprise chains, food courts, and large franchises.</p>
              <div className="mb-1">
                <span className="text-2xl font-extrabold text-gray-900">
                  Custom pricing
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium mb-5 min-h-[20px]">
                Negotiate based on scale & requirements
              </p>
              <ul className="space-y-3 mb-6 flex-1 text-xs text-gray-700 font-medium">
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> <strong>Unlimited</strong> Tables</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> <strong>Unlimited</strong> Menu items</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> <strong>Unlimited</strong> Staff accounts</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> <strong>Unlimited</strong> Order history</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> Consolidated analytics</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> Advanced custom branding</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> Full CRM + Loyalty rewards</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> Reports export (CSV / Excel)</li>
                <li className="flex gap-2.5 items-center"><Check size={15} className="text-amber-500 shrink-0"/> Priority support + Onboarding</li>
              </ul>
              <a href="mailto:contact@dynease.in?subject=Custom%20Plan%20Inquiry%20-%20Dynease" className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold text-center transition-all shadow-md shadow-orange-500/20">
                Talk to Sales
              </a>
            </div>
          </div>

          {/* Detailed comparison redirect */}
          <div className="text-center mt-10">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
              <span>View full feature comparison & plan details</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function StepCard({ icon, title, desc }) {
  return (
    <div className="flex flex-col items-center text-center relative bg-white p-6 rounded-2xl shadow-sm border border-gray-50 z-10">
      <div className="w-20 h-20 bg-[#f0fdf4] text-[var(--color-primary)] flex items-center justify-center rounded-full mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function FeatureItem({ icon, title, desc }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-12 h-12 bg-[#f0fdf4] text-[var(--color-primary)] rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-gray-900 mb-1">{title}</h4>
        <p className="text-gray-600 text-sm">{desc}</p>
      </div>
    </div>
  );
}

function BenefitFlipCard({ benefit, isFlipped, onToggleFlip }) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = benefit.icon;

  // The card is flipped if either the parent state is active OR the user hovers on desktop
  const showBack = isFlipped || isHovered;

  return (
    <div
      className="perspective-1000 h-[500px] w-full select-none cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggleFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleFlip();
        }
      }}
      aria-label={`${benefit.title}. ${showBack ? 'Showing back side. Click to flip back.' : 'Showing front side. Click or hover to flip for details.'}`}
    >
      <div
        className={`relative w-full h-full duration-700 ease-out transform-style-3d rounded-3xl transition-transform ${
          showBack ? 'rotate-y-180' : ''
        }`}
      >
        {/* ================= FRONT FACE ================= */}
        <div className="absolute inset-0 w-full h-full backface-hidden rounded-3xl bg-white border border-gray-200/90 shadow-sm hover:shadow-xl transition-shadow duration-300 p-6 flex flex-col justify-between overflow-hidden">
          {/* Ambient corner glow */}
          <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${benefit.theme.glow} rounded-full blur-2xl pointer-events-none`} />

          {/* Top row: Category tag & Flip indicator */}
          <div className="flex items-center justify-between gap-2 z-10">
            <span className={`text-[11px] font-bold tracking-wider uppercase px-3 py-1 rounded-full border ${benefit.theme.badge}`}>
              {benefit.category}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100/80 px-2.5 py-1 rounded-full border border-gray-200 group-hover:border-emerald-300 group-hover:text-emerald-700 transition-colors">
              <RotateCw size={11} className="transition-transform duration-500 group-hover:rotate-180" />
              <span>Flip</span>
            </span>
          </div>

          {/* Center content */}
          <div className="my-auto pt-2 z-10 flex flex-col items-center text-center">
            {/* Thematic Icon Container */}
            <div className={`w-16 h-16 rounded-2xl ${benefit.theme.iconBg} flex items-center justify-center mb-5 shadow-lg transform transition-transform duration-300 group-hover:scale-110`}>
              <IconComponent size={30} strokeWidth={2.2} />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight leading-snug">
              {benefit.title}
            </h3>

            {/* Front Teaser */}
            <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-[260px]">
              {benefit.frontTeaser}
            </p>

            {/* Metric Chip */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 shadow-2xs">
              <Sparkles size={13} className="text-emerald-600" />
              <span>{benefit.metric}</span>
            </div>
          </div>

          {/* Bottom call-to-action */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 z-10">
            <span className="text-[11px] text-gray-400 font-medium">Click or hover</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] group-hover:translate-x-0.5 transition-transform">
              <span>View details</span>
              <ArrowRight size={13} />
            </span>
          </div>
        </div>

        {/* ================= BACK FACE ================= */}
        <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-3xl bg-gradient-to-br from-[#0c2f1f] via-[#0f3d28] to-[#071f14] text-white border border-emerald-500/30 shadow-2xl p-6 flex flex-col justify-between overflow-hidden">
          {/* Subtle glowing ambient lights */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-emerald-600/15 rounded-full blur-2xl pointer-events-none" />

          {/* Top row: Category & Flip-back button */}
          <div className="flex items-center justify-between gap-2 z-10">
            <span className="text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
              {benefit.category}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFlip();
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-emerald-200 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            >
              <RotateCw size={11} />
              <span>Flip back</span>
            </button>
          </div>

          {/* Middle content: Title, EXACT User Copy, and Highlights */}
          <div className="z-10 my-auto py-2">
            <h4 className="text-lg font-bold text-white mb-2.5 tracking-tight">
              {benefit.title}
            </h4>

            {/* Exact User Prompt Copy highlighted box */}
            <div className="bg-emerald-900/40 border border-emerald-400/30 rounded-xl p-3 mb-4 backdrop-blur-xs">
              <p className="text-xs text-emerald-100 font-medium leading-relaxed">
                {benefit.userDesc}
              </p>
            </div>

            {/* 3 Concrete Bullet Highlights */}
            <ul className="space-y-2.5 text-xs text-gray-200">
              {benefit.highlights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 leading-snug">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white font-semibold">{item.bold} </strong>
                    <span className="text-emerald-100/80">{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom tag / Actionable summary */}
          <div className="pt-3 border-t border-emerald-500/25 flex items-center justify-between text-xs z-10">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold text-[11px] border border-emerald-400/20">
              <Sparkles size={11} className="text-emerald-300" />
              {benefit.valueChip}
            </span>
            <span className="text-[10px] text-emerald-300/70 font-medium">Tap to return</span>
          </div>
        </div>
      </div>
    </div>
  );
}


function InteractivePhoneMockup() {
  const [activeCategory, setActiveCategory] = useState("Starters");
  const [activeTab, setActiveTab] = useState("menu");

  const menuItems = [
    { name: "Paneer Tikka", desc: "Cottage cheese marinated in spices and grilled.", price: "₹180", img: paneerTikkaImg, category: "Starters" },
    { name: "Chicken 65", desc: "Spicy and crispy chicken with South Indian spices.", price: "₹220", img: chicken65Img, category: "Starters" },
    { name: "Veg Spring Rolls", desc: "Crispy rolls with fresh vegetables.", price: "₹160", img: vegSpringRollsImg, category: "Starters" },
    { name: "Fish Fingers", desc: "Crispy breaded fish served with tartar sauce.", price: "₹200", img: fishFingersImg, category: "Starters" },
    
    { name: "Chicken Hot & Sour", desc: "Classic creamy tomato soup served with croutons.", price: "₹120", img: chickenHotSourImg, category: "Soups" },
    { name: "Chicken Manchow", desc: "Spicy and tangy Chinese soup.", price: "₹140", img: chickenManchowImg, category: "Soups" },
    { name: "Tomato Soup", desc: "Spicy and tangy Chinese soup.", price: "₹140", img: tomatoSoupImg, category: "Soups" },
    { name: "Veg Manchow Soup", desc: "Spicy and tangy Chinese soup.", price: "₹140", img: vegManchowImg, category: "Soups" },

    { name: "Garlic Butter Prawns", desc: "Juicy prawns sautéed in garlic and herbs.", price: "₹400", img: seafood2Img, category: "Sea Food" },
    { name: "Crispy Fried Fish", desc: "Golden fried fish served with spicy mayo.", price: "₹380", img: seafood1Img, category: "Sea Food" },
    { name: "Grilled Crab", desc: "Fresh fish fillet grilled with lemon butter.", price: "₹450", img: seafood3Img, category: "Sea Food" },

    { name: "Mutton Biryani", desc: "Aromatic basmati rice cooked with tender mutton.", price: "₹350", img: muttonBiryaniImg, category: "Biryani" },
    { name: "Chicken Biryani Combo", desc: "Served with salan, raita, and dessert.", price: "₹380", img: chickenBiryaniComboImg, category: "Biryani" },
    { name: "Chicken Dum Biryani", desc: "Slow-cooked chicken with fragrant basmati rice.", price: "₹280", img: chickenDumBiryaniImg, category: "Biryani" },
    { name: "Paneer Biryani", desc: "Aromatic rice cooked with marinated paneer cubes.", price: "₹250", img: paneerBiryaniImg, category: "Biryani" },
    { name: "Veg Dum Biryani", desc: "Mixed vegetable biryani with aromatic spices.", price: "₹220", img: vegDumBiryaniImg, category: "Biryani" },
  ];

  const categories = ["Starters", "Soups", "Sea Food", "Biryani"];
  const [stage, setStage] = useState('splash'); // 'splash' -> 'scanning' -> 'home'
  const [scanSuccess, setScanSuccess] = useState(false);

  useEffect(() => {
    let t1, t2, t3;
    if (stage === 'splash') {
      setScanSuccess(false);
      t1 = setTimeout(() => {
        setStage('scanning');
      }, 1000);
    } else if (stage === 'scanning') {
      // Single scan pass takes 1.1s
      t2 = setTimeout(() => {
        setScanSuccess(true);
      }, 1100);
      // Immediately redirect to home page
      t3 = setTimeout(() => {
        setStage('home');
      }, 1750);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [stage]);

  return (
    <div className="w-[300px] h-[600px] bg-white rounded-[2.5rem] border-[12px] border-gray-900 shadow-2xl relative overflow-hidden flex flex-col z-10 mx-auto group">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-20"></div>

      <style>{`
        @keyframes qrLaserScanSingle {
          0% { top: 8px; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: calc(100% - 16px); opacity: 0; }
        }
        .animate-qr-laser-single {
          animation: qrLaserScanSingle 1.1s cubic-bezier(0.4, 0, 0.2, 1) 1 forwards;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 1. Splash Screen */}
      {stage === 'splash' && (
        <div className="flex-1 bg-white flex flex-col items-center justify-center h-full w-full relative select-none">
          <div className="text-center animate-pulse">
            <img src={iconImg} alt="Dynease Icon" className="w-24 h-24 mx-auto mb-4 object-contain drop-shadow" />
            <h1 className="text-3xl font-extrabold text-[var(--color-primary)] tracking-widest">Dynease</h1>
            <p className="text-xs text-gray-400 font-medium mt-1">Smart Dining Experience</p>
          </div>
          <div className="absolute bottom-10 flex items-center gap-2 text-[11px] text-gray-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Initializing...</span>
          </div>
        </div>
      )}

      {/* 2. QR Scanning Screen with Animation */}
      {stage === 'scanning' && (
        <div className="flex-1 bg-gradient-to-b from-gray-950 via-slate-900 to-gray-950 text-white flex flex-col justify-between items-center p-4 pt-9 pb-6 relative overflow-hidden select-none">
          {/* Subtle viewfinder grid dots */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

          {/* Top scanner header */}
          <div className="w-full flex flex-col items-center z-10 text-center">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 backdrop-blur-md border border-emerald-400/30 text-[10px] text-emerald-300 font-semibold mb-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Camera View
            </div>
            <h3 className="font-bold text-sm text-white tracking-wide">Scan Table QR</h3>
            <p className="text-[10px] text-gray-400">Point camera at the table QR code</p>
          </div>

          {/* Viewfinder Target Container */}
          <div className="relative w-52 h-52 flex items-center justify-center my-auto">
            {/* 4 Glowing Corner Reticles */}
            <div className={`absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] rounded-tl-xl transition-all duration-300 ${scanSuccess ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
            <div className={`absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] rounded-tr-xl transition-all duration-300 ${scanSuccess ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
            <div className={`absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] rounded-bl-xl transition-all duration-300 ${scanSuccess ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
            <div className={`absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] rounded-br-xl transition-all duration-300 ${scanSuccess ? 'border-emerald-400 shadow-[0_0_15px_#10b981]' : 'border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>

            {/* Table QR Standee Card */}
            <div className={`w-40 bg-white rounded-2xl p-3 shadow-2xl flex flex-col items-center border transition-all duration-300 ${scanSuccess ? 'scale-105 border-emerald-400 ring-2 ring-emerald-400/50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <img src={iconImg} alt="Dynease" className="w-4 h-4 object-contain" />
                <span className="text-[10px] font-extrabold text-emerald-800 tracking-wider">SPICE GARDEN</span>
              </div>
              <div className="p-1 bg-white rounded-lg border border-gray-100 shadow-sm">
                <QRCodeSVG 
                  value="https://dynease.com/r/spice-garden?table=04"
                  size={104}
                  level="M"
                  fgColor="#0f3b25"
                />
              </div>
              <div className="mt-2 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold tracking-wide">
                TABLE 04
              </div>
            </div>

            {/* Single Sweeping Laser Beam Animation (One Time Only) */}
            {!scanSuccess && (
              <div className="absolute inset-x-3 pointer-events-none animate-qr-laser-single z-20">
                <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399,0_0_4px_#10b981]"></div>
                <div className="h-10 bg-gradient-to-b from-emerald-400/25 to-transparent"></div>
              </div>
            )}

            {/* Success Modal / Feedback */}
            {scanSuccess && (
              <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-[2px] rounded-2xl flex flex-col items-center justify-center p-3 text-center z-30 border border-emerald-400/70 shadow-[0_0_25px_rgba(16,185,129,0.5)] animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-lg ring-4 ring-emerald-400/30">
                  <CheckCircle2 size={28} className="stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-widest">Table 04 Verified</span>
                <p className="text-xs font-semibold text-white mt-0.5">Opening Spice Garden...</p>
              </div>
            )}
          </div>

          {/* Bottom Status Indicator */}
          <div className="w-full flex flex-col items-center gap-2 z-10">
            <div className={`px-3.5 py-1.5 rounded-full backdrop-blur-md border text-[11px] font-medium flex items-center gap-2 transition-all ${scanSuccess ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 scale-105' : 'bg-white/10 border-white/15 text-gray-300'}`}>
              {scanSuccess ? (
                <>
                  <Sparkles size={13} className="text-emerald-300 animate-spin" />
                  <span>Redirecting to menu...</span>
                </>
              ) : (
                <>
                  <ScanLine size={13} className="text-emerald-400 animate-pulse" />
                  <span>Scanning QR code...</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Home Page (Menu, Cart, Orders) */}
      {stage === 'home' && (
        <>

          {activeTab === 'menu' && (
            <>
              <div className="relative h-40 bg-gray-100 flex-shrink-0">
                <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=500&q=80" alt="Restaurant" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>
                <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end text-white">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">Spice Garden</h3>
                    <p className="text-xs text-gray-200">Authentic Flavors, Always</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-950/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-400/40 text-emerald-300 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[10px] font-bold tracking-wide">Table 04</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 p-4 overflow-x-auto border-b flex-shrink-0 no-scrollbar">
                {categories.map((cat) => (
                  <span 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap cursor-pointer transition-colors ${activeCategory === cat ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {cat}
                  </span>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50 pb-20 scroll-smooth no-scrollbar">
                {menuItems.filter(item => item.category === activeCategory).map((item, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl shadow-sm flex gap-3 border border-gray-100 transform transition-transform hover:scale-[1.02] cursor-pointer">
                    <img src={item.img} className="w-20 h-20 object-cover rounded-lg" alt={item.name} />
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">{item.name}</h4>
                        <p className="text-[10px] text-gray-500 leading-tight mt-1 line-clamp-2">{item.desc}</p>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-bold text-sm">{item.price}</span>
                        <button className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-lg leading-none">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'cart' && (
            <div className="flex-1 bg-gray-50 flex flex-col overflow-y-auto pb-20 no-scrollbar pt-6">
              <div className="bg-white p-4 border-b">
                <h3 className="font-bold text-lg">Your Cart</h3>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm">Chicken Dum Biryani</h4>
                    <p className="text-xs text-gray-500">Qty: 1</p>
                  </div>
                  <span className="font-bold text-sm">₹280</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm">Garlic Naan</h4>
                    <p className="text-xs text-gray-500">Qty: 2</p>
                  </div>
                  <span className="font-bold text-sm">₹100</span>
                </div>
              </div>
              <div className="mt-auto p-4 bg-white border-t">
                 <div className="flex justify-between mb-2"><span className="text-sm">Subtotal</span><span className="font-bold text-sm">₹380</span></div>
                 <button className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-bold mt-2">Place Order</button>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="flex-1 bg-gray-50 flex flex-col overflow-y-auto pb-20 no-scrollbar pt-6">
              <div className="bg-white p-4 border-b">
                <h3 className="font-bold text-lg">My Orders</h3>
              </div>
              <div className="p-4 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">Preparing</span>
                    <span className="text-xs text-gray-500">10:42 AM</span>
                  </div>
                  <p className="font-bold text-sm mb-1">Order #4092</p>
                  <p className="text-xs text-gray-600">1x Chicken Dum Biryani, 2x Garlic Naan</p>
                  <div className="mt-3 pt-3 border-t flex justify-between">
                    <span className="text-sm font-medium">Total: ₹380</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-white border-t flex items-center justify-around px-4 z-20">
            <div 
              onClick={() => setActiveTab('menu')}
              className={`w-10 h-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${activeTab === 'menu' ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
            >
               <ListTree size={20} />
            </div>
            <div 
              onClick={() => setActiveTab('cart')}
              className={`w-10 h-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${activeTab === 'cart' ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
            >
               <ShoppingCart size={20} />
            </div>
            <div 
              onClick={() => setActiveTab('orders')}
              className={`w-10 h-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${activeTab === 'orders' ? 'text-[var(--color-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
            >
               <FileText size={20} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}