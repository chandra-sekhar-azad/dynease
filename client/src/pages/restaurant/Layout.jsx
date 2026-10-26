import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Utensils, Grid, LogOut, Users, FolderOpen, Menu, X, ClipboardList, Settings, CreditCard, CalendarDays } from 'lucide-react';
import useAuthGuard from '../../hooks/useAuthGuard';

// Roles permitted to access the restaurant owner/staff dashboard.
const RESTAURANT_ROLES = ['RESTAURANT_OWNER', 'RESTAURANT_STAFF'];

export default function RestaurantLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const authStatus = useAuthGuard(RESTAURANT_ROLES);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const links = [
    { name: 'Dashboard', path: '/restaurant', icon: <LayoutDashboard size={20} /> },
    { name: 'Orders', path: '/restaurant/orders', icon: <ClipboardList size={20} /> },
    { name: 'Tables & QR', path: '/restaurant/tables', icon: <Grid size={20} /> },
    { name: 'Waiter Assignment', path: '/restaurant/assignment', icon: <Users size={20} /> },
    { name: 'Menu', path: '/restaurant/menu', icon: <Utensils size={20} /> },
    { name: 'Categories', path: '/restaurant/categories', icon: <FolderOpen size={20} /> },
    { name: 'Staff', path: '/restaurant/staff', icon: <Users size={20} /> },
    { name: 'Staff Roster', path: '/restaurant/roster', icon: <CalendarDays size={20} /> },
    { name: 'Subscription & Billing', path: '/restaurant/subscription', icon: <CreditCard size={20} /> },
    { name: 'Settings', path: '/restaurant/settings', icon: <Settings size={20} /> },
  ];

  if (authStatus !== 'allowed') {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <aside className={`fixed md:static inset-y-0 left-0 z-50 bg-slate-900 text-white flex flex-col transition-transform duration-300 w-64 md:w-64 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} overflow-hidden select-none`}>
        <div className="w-64 flex flex-col h-full overflow-hidden">
          <div className="p-6 flex justify-between items-center border-b border-slate-800 shrink-0">
            <Link to="/restaurant" className="flex items-center gap-2">
              <img 
                src="/brand/logo-horizontal-reversed.svg" 
                alt="Dynease" 
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/brand/logo-horizontal-reversed.png';
                }}
              />
            </Link>
            <button className="md:hidden text-gray-400 hover:text-white cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.map((link) => {
            const isActive = location.pathname === link.path || location.pathname.startsWith(link.path + '/');
            return (
              <Link 
                key={link.path}
                to={link.path}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {link.icon}
                {link.name}
              </Link>
            )
          })}
        </nav>

          <div className="p-4 border-t border-slate-800 shrink-0">
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white w-full transition-colors cursor-pointer">
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white h-16 border-b border-gray-200 flex items-center px-4 md:px-8 justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-800 truncate">Restaurant Dashboard</h1>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-3 sm:p-5 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
