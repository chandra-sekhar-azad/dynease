import React, { useState } from 'react';
import { 
  PlayCircle, Check, ArrowRight,
  ScanLine, ListTree, ShoppingCart, Smile,
  FileText, Columns, Zap, Users, Monitor, BarChart2
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

export default function LandingPage() {
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
              <button className="bg-white border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[#f0fdf4] px-8 py-3.5 rounded-full font-medium text-base transition-colors flex items-center gap-2">
                <PlayCircle size={18} /> Watch Demo
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
          <div className="text-center mb-16">
            <p className="text-[var(--color-primary)] font-bold text-xs tracking-widest uppercase mb-2">SIMPLE & TRANSPARENT PRICING</p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Choose the Plan That Fits Your Restaurant</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-xl font-bold mb-2">Free Trial</h3>
              <div className="mb-6"><span className="text-4xl font-bold">₹0</span><span className="text-gray-500"> / 14 days</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-sm text-gray-600">
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Up to 5 tables</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Basic menu items</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Order management</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Standard support</li>
              </ul>
              <Link to="/register" className="w-full py-3 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[#f0fdf4] font-medium text-center transition-colors">Start Free Trial</Link>
            </div>
            
            {/* Growth Tier */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-[var(--color-primary)] flex flex-col relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-primary)] text-white text-xs font-bold uppercase tracking-wide py-1 px-4 rounded-full">Most Popular</div>
              <h3 className="text-xl font-bold mb-2">Growth</h3>
              <div className="mb-6"><span className="text-4xl font-bold">₹999</span><span className="text-gray-500"> / month</span></div>
              <ul className="space-y-4 mb-8 flex-1 text-sm text-gray-600">
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Unlimited tables</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Unlimited menu items</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Real-time / live orders</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Kitchen Display System</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Restaurant dashboard</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Staff accounts</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Offers & coupons</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Customer reviews</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Advanced analytics</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Remove platform branding</li>
              </ul>
              <Link to="/register" className="w-full py-3 rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)] font-medium text-center transition-colors">Get Started</Link>
            </div>

            {/* Pro Tier */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-xl font-bold mb-2">Pro</h3>
              <div className="mb-6"><span className="text-4xl font-bold">₹1,999</span><span className="text-gray-500"> / month</span></div>
              <p className="text-sm text-gray-500 mb-4">For growing restaurants</p>
              <ul className="space-y-4 mb-8 flex-1 text-sm text-gray-600">
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> All Growth features</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Multiple branches</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Multiple kitchen stations</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Advanced reports</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Customer database / CRM</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Loyalty system</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Priority support</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Custom branding</li>
                <li className="flex gap-3 items-center"><Check size={16} className="text-[var(--color-primary)]"/> Custom domain</li>
              </ul>
              <Link to="/register" className="w-full py-3 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[#f0fdf4] font-medium text-center transition-colors">Contact Sales</Link>
            </div>
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
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-[300px] h-[600px] bg-white rounded-[2.5rem] border-[12px] border-gray-900 shadow-2xl relative overflow-hidden flex flex-col z-10 mx-auto group">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl z-20"></div>

      {showSplash ? (
        <div className="flex-1 bg-white flex items-center justify-center h-full w-full">
          <div className="text-center animate-pulse">
            <img src={iconImg} alt="Dynease Icon" className="w-24 h-24 mx-auto mb-4 object-contain" />
            <h1 className="text-3xl font-extrabold text-orange-600 tracking-widest">Dynease</h1>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'menu' && (
        <>
          <div className="relative h-40 bg-gray-100 flex-shrink-0">
            <img src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=500&q=80" alt="Restaurant" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
            <div className="absolute bottom-4 left-4 text-white">
              <h3 className="font-bold text-lg">Spice Garden</h3>
              <p className="text-xs opacity-80">Authentic Flavors, Always</p>
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
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
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
                    <button className="w-6 h-6 bg-[#ff6b00] text-white rounded-full flex items-center justify-center text-lg leading-none">+</button>
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
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">Preparing</span>
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