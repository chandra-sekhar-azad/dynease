import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Utensils,
  Grid,
  ChefHat,
  BarChart3,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  Clock,
  QrCode,
  DollarSign,
  TrendingUp,
  Download,
  Plus,
  Search,
  Filter,
  Eye,
  Store,
  ChevronRight,
  ExternalLink,
  Flame,
  Coffee,
  Check,
  AlertCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import GuidedTour from '../components/tour/GuidedTour';
import { TOUR_STEPS } from '../components/tour/tourSteps';
import { toast } from '../context/DialogContext';

// Initial Mock Data for Spice Garden Bistro Demo
const INITIAL_STATS = {
  todaysOrders: 48,
  revenue: 24850,
  activeTables: 7,
  totalTables: 12,
  avgPrepTime: '14 mins',
  growth: '+18.4%',
};

const MOCK_ORDERS = [
  {
    id: 'ORD-1048',
    table: 3,
    time: '2 mins ago',
    status: 'PENDING',
    customer: 'Aarav Patel',
    total: 820,
    items: [
      { name: 'Paneer Butter Masala', qty: 1, price: 320 },
      { name: 'Garlic Naan', qty: 3, price: 180 },
      { name: 'Mango Lassi', qty: 2, price: 320 },
    ],
    note: 'Make the Paneer medium spicy, please',
  },
  {
    id: 'ORD-1047',
    table: 7,
    time: '8 mins ago',
    status: 'PREPARING',
    customer: 'Sneha Sharma',
    total: 1140,
    items: [
      { name: 'Chicken Tikka', qty: 2, price: 680 },
      { name: 'Butter Naan', qty: 2, price: 160 },
      { name: 'Virgin Mojito', qty: 2, price: 300 },
    ],
    note: 'Extra green chutney on the side',
  },
  {
    id: 'ORD-1046',
    table: 2,
    time: '15 mins ago',
    status: 'READY',
    customer: 'Vikram Mehta',
    total: 540,
    items: [
      { name: 'Dal Makhani', qty: 1, price: 280 },
      { name: 'Jeera Rice', qty: 1, price: 160 },
      { name: 'Fresh Lime Soda', qty: 1, price: 100 },
    ],
    note: 'Quick service requested',
  },
  {
    id: 'ORD-1045',
    table: 5,
    time: '32 mins ago',
    status: 'SERVED',
    customer: 'Rohan Gupta',
    total: 1420,
    items: [
      { name: 'Tandoori Platter', qty: 1, price: 850 },
      { name: 'Kashmiri Pulao', qty: 1, price: 320 },
      { name: 'Gulab Jamun (2 pcs)', qty: 2, price: 250 },
    ],
    note: 'Celebrating anniversary',
  },
];

const MOCK_MENU = [
  { id: 1, name: 'Paneer Butter Masala', category: 'Main Course', price: 320, prepTime: 15, diet: 'VEG', available: true, desc: 'Cottage cheese cubes cooked in rich tomato cashew gravy' },
  { id: 2, name: 'Chicken Tikka Masala', category: 'Main Course', price: 380, prepTime: 18, diet: 'NON_VEG', available: true, desc: 'Chargrilled boneless chicken in spiced aromatic gravy' },
  { id: 3, name: 'Crispy Veg Spring Rolls', category: 'Starters', price: 240, prepTime: 12, diet: 'VEGAN', available: true, desc: 'Golden shredded vegetable rolls with sweet chili dip' },
  { id: 4, name: 'Tandoori Chicken (Half)', category: 'Starters', price: 360, prepTime: 20, diet: 'NON_VEG', available: true, desc: 'Clay oven roasted bone-in chicken marinated in yogurt and spices' },
  { id: 5, name: 'Garlic Herb Naan', category: 'Breads', price: 70, prepTime: 5, diet: 'VEG', available: true, desc: 'Handcrafted tandoori bread with crushed garlic and butter' },
  { id: 6, name: 'Mango Mint Lassi', category: 'Beverages', price: 160, prepTime: 5, diet: 'VEG', available: true, desc: 'Thick churned yogurt blended with Alphonso mango pulp' },
  { id: 7, name: 'Sizzling Brownie with Ice Cream', category: 'Desserts', price: 220, prepTime: 8, diet: 'VEG', available: true, desc: 'Hot chocolate brownie topped with vanilla bean ice cream and fudge' },
  { id: 8, name: 'Dal Makhani Bukhara', category: 'Main Course', price: 280, prepTime: 14, diet: 'VEG', available: true, desc: 'Slow simmered black lentils finished with cream and white butter' },
];

const MOCK_TABLES = [
  { id: 't1', number: 1, name: 'Window Bay 1', capacity: 2, occupied: false, area: 'Main Dining' },
  { id: 't2', number: 2, name: 'Center Booth', capacity: 4, occupied: true, area: 'Main Dining' },
  { id: 't3', number: 3, name: 'Family Table', capacity: 6, occupied: true, area: 'Main Dining' },
  { id: 't4', number: 4, name: 'Garden Terrace 1', capacity: 4, occupied: false, area: 'Patio' },
  { id: 't5', number: 5, name: 'Garden Terrace 2', capacity: 4, occupied: true, area: 'Patio' },
  { id: 't6', number: 6, name: 'Rooftop Lounge 1', capacity: 8, occupied: false, area: 'Rooftop' },
];

export default function DemoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Tour State
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Demo interactive state
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [menuItems, setMenuItems] = useState(MOCK_MENU);
  const [tables, setTables] = useState(MOCK_TABLES);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [orderFilter, setOrderFilter] = useState('ALL');

  // Start tour from query param (?tour=true) on initial mount
  useEffect(() => {
    const shouldStartTour = searchParams.get('tour') === 'true' || searchParams.get('tour') === '1';
    if (shouldStartTour) {
      // Small delay to ensure all responsive layout elements are measured
      const timer = setTimeout(() => {
        setRunTour(true);
        setStepIndex(0);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Synchronize active tab when tour step changes
  const handleStepChange = useCallback((newIndex) => {
    setStepIndex(newIndex);
    const targetStep = TOUR_STEPS[newIndex];
    if (targetStep?.data?.tab) {
      setActiveTab(targetStep.data.tab);
    }
  }, []);

  // Stop tour cleanly and remove query parameter
  const handleTourFinish = useCallback(() => {
    setRunTour(false);
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Restart tour manually
  const restartTour = () => {
    setActiveTab('dashboard');
    setStepIndex(0);
    setRunTour(true);
  };

  // Demo state mutators (isolated to demo memory)
  const handleAdvanceOrderStatus = (orderId) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id !== orderId) return ord;
        const nextStatus =
          ord.status === 'PENDING'
            ? 'PREPARING'
            : ord.status === 'PREPARING'
            ? 'READY'
            : ord.status === 'READY'
            ? 'SERVED'
            : ord.status;
        return { ...ord, status: nextStatus };
      })
    );
  };

  const handleToggleMenuAvailability = (id) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, available: !item.available } : item))
    );
  };

  const handleToggleTableOccupancy = (id) => {
    setTables((prev) =>
      prev.map((tbl) => (tbl.id === id ? { ...tbl, occupied: !tbl.occupied } : tbl))
    );
  };

  const filteredMenuItems =
    selectedCategory === 'ALL'
      ? menuItems
      : menuItems.filter((i) => i.category === selectedCategory);

  const filteredOrders =
    orderFilter === 'ALL'
      ? orders
      : orders.filter((o) => o.status === orderFilter);

  return (
    <div className="min-h-screen bg-slate-50 text-gray-800 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Demo Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group" title="Return to Dynease Home">
              <img
                src="/brand/logo-horizontal.svg"
                alt="Dynease Logo"
                className="h-7 sm:h-8 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/brand/logo-horizontal.png';
                }}
              />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <Store size={13} className="text-emerald-600" />
              <span>Spice Garden Bistro (Demo)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={restartTour}
              className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
              title="Restart the step-by-step product tour"
            >
              <RotateCcw size={15} />
              <span className="hidden xs:inline">Restart Tour</span>
            </button>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md shadow-emerald-700/20 active:scale-95"
            >
              <span>Start Free Trial</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-gray-100 overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1 sm:space-x-2 py-2" aria-label="Demo Tabs">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'orders', label: 'Live Orders', icon: ClipboardList, badge: orders.filter(o => o.status === 'PENDING').length },
              { id: 'menu', label: 'Menu Management', icon: Utensils },
              { id: 'tables', label: 'Tables & QR', icon: Grid },
              { id: 'kitchen', label: 'Kitchen Display (KDS)', icon: ChefHat },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {tab.badge ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Step 1 Target: Welcome Banner */}
        <div
          data-tour="welcome"
          className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 mb-3">
              <Sparkles size={14} className="text-emerald-300" />
              <span>Interactive Guest Sandbox</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2">
              Explore Dynease Restaurant Operations
            </h1>
            <p className="text-emerald-100 text-sm sm:text-base leading-relaxed mb-5">
              Welcome to the live interactive tour. Dynease transforms dine-in service with instant contactless QR ordering, live kitchen coordination, and unified menu management. You can click around, test features, or let our guided tour walk you through each capability.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={restartTour}
                className="bg-white text-emerald-900 hover:bg-emerald-50 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Sparkles size={16} className="text-emerald-700" />
                <span>Start Guided Tour</span>
              </button>
              <div className="flex items-center gap-4 text-xs text-emerald-200 font-medium">
                <span className="flex items-center gap-1"><Check size={14} className="text-emerald-400" /> No account required</span>
                <span className="flex items-center gap-1"><Check size={14} className="text-emerald-400" /> Safe mock sandbox</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Step 2 Target: Dashboard Overview */}
            <div data-tour="dashboard" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Today's Restaurant Overview</h2>
                  <p className="text-xs sm:text-sm text-gray-500">Live operational metrics for Spice Garden Bistro</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Real-time updates connected</span>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Today's Orders</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><ClipboardList size={18} /></div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{INITIAL_STATS.todaysOrders}</div>
                  <div className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> {INITIAL_STATS.growth} vs yesterday
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Today's Revenue</span>
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-700"><DollarSign size={18} /></div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">₹{INITIAL_STATS.revenue.toLocaleString()}</div>
                  <div className="text-xs font-semibold text-blue-600 mt-1">₹518 avg order value</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Tables</span>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700"><Grid size={18} /></div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{INITIAL_STATS.activeTables} / {INITIAL_STATS.totalTables}</div>
                  <div className="text-xs font-semibold text-amber-700 mt-1">58% occupancy rate</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <div className="flex items-center justify-between text-gray-500 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Avg Prep Time</span>
                    <div className="p-2 rounded-xl bg-purple-50 text-purple-700"><Clock size={18} /></div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{INITIAL_STATS.avgPrepTime}</div>
                  <div className="text-xs font-semibold text-purple-700 mt-1">Optimal kitchen pace</div>
                </div>
              </div>

              {/* Dashboard Split Views */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 text-base">Recent Live Orders</h3>
                    <button onClick={() => setActiveTab('orders')} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer">
                      View all orders <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((ord) => (
                      <div key={ord.id} className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100/80 transition-colors border border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                            T{ord.table}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span>{ord.id}</span>
                              <span className="text-xs font-medium text-gray-500">• {ord.customer}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {ord.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">₹{ord.total}</div>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ord.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                            ord.status === 'PREPARING' ? 'bg-blue-100 text-blue-800' :
                            ord.status === 'READY' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {ord.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                  <h3 className="font-bold text-gray-900 text-base mb-4">Top Performing Dishes</h3>
                  <div className="space-y-3.5">
                    {[
                      { name: 'Paneer Butter Masala', orders: 28, revenue: '₹8,960' },
                      { name: 'Chicken Tikka Masala', orders: 24, revenue: '₹9,120' },
                      { name: 'Garlic Herb Naan', orders: 62, revenue: '₹4,340' },
                      { name: 'Mango Mint Lassi', orders: 34, revenue: '₹5,440' },
                    ].map((dish, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center">{i + 1}</span>
                          <span className="font-medium text-gray-800 text-xs sm:text-sm">{dish.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-900 text-xs sm:text-sm">{dish.revenue}</span>
                          <div className="text-[10px] text-gray-400">{dish.orders} orders</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Live Orders */}
        {activeTab === 'orders' && (
          <div data-tour="orders" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Live Customer Orders</h2>
                <p className="text-xs sm:text-sm text-gray-500">Incoming QR orders update immediately. Click actions to advance order stage.</p>
              </div>
              <div className="flex items-center gap-2">
                {['ALL', 'PENDING', 'PREPARING', 'READY', 'SERVED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setOrderFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      orderFilter === status
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrders.map((ord) => (
                <div key={ord.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-sm">Table {ord.table}</span>
                          <span className="font-bold text-gray-900 text-sm">{ord.id}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{ord.customer} • {ord.time}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        ord.status === 'PENDING' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        ord.status === 'PREPARING' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        ord.status === 'READY' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        • {ord.status}
                      </span>
                    </div>

                    <div className="border-t border-b border-gray-100 py-3 my-3 space-y-2">
                      {ord.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-xs sm:text-sm">
                          <span className="text-gray-800 font-medium">{item.qty}x {item.name}</span>
                          <span className="text-gray-500 font-semibold">₹{item.price}</span>
                        </div>
                      ))}
                    </div>

                    {ord.note && (
                      <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-xs text-amber-900 mb-4 flex items-start gap-1.5">
                        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                        <span><strong>Special Note:</strong> {ord.note}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                    <div className="text-base font-extrabold text-gray-900">Total: ₹{ord.total}</div>
                    {ord.status !== 'SERVED' ? (
                      <button
                        onClick={() => handleAdvanceOrderStatus(ord.id)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                      >
                        {ord.status === 'PENDING' && 'Accept Order'}
                        {ord.status === 'PREPARING' && 'Mark Ready'}
                        {ord.status === 'READY' && 'Mark Served'}
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                        <CheckCircle size={14} className="text-emerald-500" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Menu Management */}
        {activeTab === 'menu' && (
          <div data-tour="menu" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Menu Management</h2>
                <p className="text-xs sm:text-sm text-gray-500">Configure dish items, pricing, dietary tags, and real-time availability toggles.</p>
              </div>
              <button
                onClick={() => toast.info('In the live platform, restaurant owners can add dishes with high-resolution photos, custom variant add-ons, and pricing tiers.')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Plus size={16} /> Add Menu Item
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {['ALL', 'Starters', 'Main Course', 'Breads', 'Beverages', 'Desserts'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat === 'ALL' ? 'All Dishes' : cat}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredMenuItems.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.diet === 'VEG' ? 'bg-emerald-100 text-emerald-800' :
                        item.diet === 'NON_VEG' ? 'bg-red-100 text-red-800' :
                        'bg-teal-100 text-teal-800'
                      }`}>
                        {item.diet}
                      </span>
                      <span className="text-[11px] font-semibold text-gray-400">{item.category}</span>
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 leading-snug mb-1">{item.name}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{item.desc}</p>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="text-base font-extrabold text-gray-900">₹{item.price}</div>
                      <div className="text-[10px] text-gray-400">{item.prepTime} mins prep</div>
                    </div>

                    {/* Interactive 86/Availability Toggle */}
                    <button
                      onClick={() => handleToggleMenuAvailability(item.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        item.available
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                      title="Click to toggle availability"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.available ? 'bg-emerald-600' : 'bg-gray-500'}`} />
                      <span>{item.available ? 'Available' : 'Out of Stock'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Tables and QR Codes */}
        {activeTab === 'tables' && (
          <div data-tour="tables" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Restaurant Tables & QR Codes</h2>
                <p className="text-xs sm:text-sm text-gray-500">Each table possesses a stable contactless QR code for direct digital ordering.</p>
              </div>
              <button
                onClick={() => toast.info('In the live platform, restaurants can generate high-resolution print ready QR flyers or batch-download SVGs for tables.')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Plus size={16} /> Add New Table
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tables.map((table) => {
                const demoUrl = `https://spicegarden.dynease.in/t/demo-${table.number}`;
                return (
                  <div key={table.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Table {table.number}</h3>
                          <p className="text-xs text-gray-500 font-medium">{table.name} • {table.capacity} Seats ({table.area})</p>
                        </div>
                        <button
                          onClick={() => handleToggleTableOccupancy(table.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                            table.occupied
                              ? 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title="Click to toggle occupancy"
                        >
                          {table.occupied ? '• Occupied' : '• Available'}
                        </button>
                      </div>

                      {/* QR Display */}
                      <div className="flex flex-col items-center bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-4">
                        <div className="bg-white p-3 rounded-xl shadow-xs border border-gray-100 mb-2">
                          <QRCodeSVG
                            value={demoUrl}
                            size={120}
                            level="M"
                            fgColor="#0f3b25"
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-gray-500 tracking-wide">
                          SCAN TO ORDER AT TABLE {table.number}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-full">
                          {demoUrl}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => toast.success(`Downloaded printable SVG QR code for Table ${table.number}`)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download size={14} /> Download SVG
                      </button>
                      <button
                        onClick={() => toast.info(`Opening preview of table ${table.number} customer digital menu`)}
                        className="py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Simulate diner scan"
                      >
                        <Eye size={14} /> Preview
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 5: Kitchen Display System */}
        {activeTab === 'kitchen' && (
          <div data-tour="kitchen" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Kitchen Display System (KDS)</h2>
                <p className="text-xs sm:text-sm text-gray-500">Live ticket queue for kitchen chefs. Eliminates paper tickets and missed modifications.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                <ChefHat size={16} /> Kitchen Station 1 (Hot Line)
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  ticket: '#ORD-1048',
                  table: 3,
                  elapsed: '02:45',
                  urgency: 'normal',
                  items: [
                    { name: 'Paneer Butter Masala', note: 'Medium spicy', done: false },
                    { name: 'Garlic Naan x3', note: 'Crispy well-done', done: true },
                    { name: 'Mango Lassi x2', note: 'Cold', done: true },
                  ],
                },
                {
                  ticket: '#ORD-1047',
                  table: 7,
                  elapsed: '08:14',
                  urgency: 'medium',
                  items: [
                    { name: 'Chicken Tikka x2', note: 'Clay oven grill', done: false },
                    { name: 'Butter Naan x2', note: 'Hot', done: false },
                    { name: 'Virgin Mojito x2', note: 'Bar counter', done: true },
                  ],
                },
                {
                  ticket: '#ORD-1044',
                  table: 1,
                  elapsed: '14:50',
                  urgency: 'high',
                  items: [
                    { name: 'Dal Bukhara Special', note: 'Extra butter', done: true },
                    { name: 'Jeera Rice', note: 'Steamed', done: true },
                  ],
                },
              ].map((ticket, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs flex flex-col justify-between">
                  <div>
                    <div className={`p-4 text-white flex items-center justify-between ${
                      ticket.urgency === 'high' ? 'bg-rose-600' :
                      ticket.urgency === 'medium' ? 'bg-amber-600' :
                      'bg-emerald-700'
                    }`}>
                      <div>
                        <div className="font-extrabold text-base">{ticket.ticket}</div>
                        <div className="text-xs text-white/90">Table {ticket.table}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm flex items-center gap-1 justify-end">
                          <Clock size={14} /> {ticket.elapsed}
                        </div>
                        <div className="text-[10px] uppercase font-semibold tracking-wider text-white/80">Prep Timer</div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {ticket.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 pb-2 border-b border-gray-100 last:border-none">
                          <input
                            type="checkbox"
                            defaultChecked={item.done}
                            className="mt-1 h-4 w-4 rounded-md text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div>
                            <div className="text-sm font-bold text-gray-900">{item.name}</div>
                            {item.note && <div className="text-xs text-amber-700 font-medium">Note: {item.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                    <button
                      onClick={() => toast.success(`Marked ${ticket.ticket} ready for waiter delivery!`)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    >
                      <CheckCircle size={15} /> Order Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Analytics */}
        {activeTab === 'analytics' && (
          <div data-tour="analytics" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Performance & Sales Analytics</h2>
                <p className="text-xs sm:text-sm text-gray-500">Deep operational intelligence to boost guest spending and streamline capacity.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl">
                Last 30 Days (Demo Period)
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Monthly Gross Sales</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">₹3,42,800</div>
                <div className="text-xs font-bold text-emerald-600 mt-1">+24% vs prior month</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Average Table Spend</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">₹780</div>
                <div className="text-xs font-bold text-emerald-600 mt-1">+15% due to photo menus</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">QR Scan-to-Order Rate</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">84.2%</div>
                <div className="text-xs font-bold text-blue-600 mt-1">High diner adoption</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Table Turnover</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">38 mins</div>
                <div className="text-xs font-bold text-purple-600 mt-1">18 mins saved per table</div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                <h3 className="font-bold text-gray-900 text-base mb-4">Sales by Menu Category</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Main Course', percentage: 52, amount: '₹1,78,256', color: 'bg-emerald-600' },
                    { label: 'Starters & Appetizers', percentage: 28, amount: '₹95,984', color: 'bg-teal-500' },
                    { label: 'Beverages & Drinks', percentage: 12, amount: '₹41,136', color: 'bg-blue-500' },
                    { label: 'Desserts & Sweets', percentage: 8, amount: '₹27,424', color: 'bg-amber-500' },
                  ].map((cat, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-xs sm:text-sm font-semibold">
                        <span className="text-gray-800">{cat.label}</span>
                        <span className="text-gray-900">{cat.amount} ({cat.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`${cat.color} h-2 rounded-full`} style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
                <h3 className="font-bold text-gray-900 text-base mb-4">Peak Dining Rush Hours</h3>
                <div className="space-y-3">
                  {[
                    { time: '12:30 PM - 02:30 PM (Lunch Rush)', traffic: 'High', tables: '11/12 occupied' },
                    { time: '04:00 PM - 06:30 PM (Evening Snacks)', traffic: 'Moderate', tables: '5/12 occupied' },
                    { time: '07:30 PM - 10:30 PM (Dinner Peak)', traffic: 'Maximum', tables: '12/12 occupied' },
                  ].map((slot, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-gray-900">{slot.time}</div>
                        <div className="text-xs text-gray-500">{slot.tables}</div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        slot.traffic === 'Maximum' ? 'bg-rose-100 text-rose-800' :
                        slot.traffic === 'High' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {slot.traffic}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 8 Target: Get Started CTA Banner */}
        <section
          data-tour="get-started"
          className="bg-white rounded-3xl border-2 border-emerald-500/20 p-6 sm:p-10 shadow-lg relative overflow-hidden"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                <Sparkles size={14} className="text-emerald-600" />
                <span>Zero Risk • Instant Setup</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                Ready to Upgrade Your Restaurant Operations?
              </h2>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                Join modern restaurants delivering frictionless QR ordering, boosting beverage orders, and cutting wait times with Dynease. Register today to activate your 14-day free trial.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <Link
                to="/register"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-7 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-md hover:shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 active:scale-95 text-center"
              >
                <span>Register Your Restaurant</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3.5 rounded-2xl font-semibold text-sm transition-colors text-center"
              >
                Back to Dynease Home
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Guided Tour Component */}
      <GuidedTour
        run={runTour}
        steps={TOUR_STEPS}
        stepIndex={stepIndex}
        onStepChange={handleStepChange}
        onFinish={handleTourFinish}
      />
    </div>
  );
}
