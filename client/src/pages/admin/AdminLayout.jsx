import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Store, Users, Settings, LogOut, Megaphone, Menu, X, CreditCard } from 'lucide-react';
import useAuthGuard from '../../hooks/useAuthGuard';

// Only platform super admins may access the system admin panel.
const ADMIN_ROLES = ['SUPER_ADMIN'];

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const location = useLocation();
  const navigate = useNavigate();
  const authStatus = useAuthGuard(ADMIN_ROLES);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
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
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
    { name: 'Restaurant Management', path: '/admin/restaurants', icon: <Store size={18} /> },
    { name: 'Plan Management', path: '/admin/plans', icon: <CreditCard size={18} /> },
    { name: 'Banner Management', path: '/admin/ads', icon: <Megaphone size={18} /> },
    { name: 'Users', path: '/admin/users', icon: <Users size={18} /> },
    { name: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
  ];

  if (authStatus !== 'allowed') {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-background)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--color-background)] overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out w-64 lg:static lg:h-screen lg:w-64 lg:translate-x-0 overflow-hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="w-64 flex flex-col h-full">
          <div className="p-6 flex items-center justify-between border-b border-[var(--color-primary-light)]">
            <h2 className="text-xl font-serif font-bold !text-white text-white tracking-wide whitespace-nowrap" style={{ color: '#ffffff' }}>Dynease Admin</h2>
            <button className="lg:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>
        
        <nav className="flex-1 px-3 space-y-1 mt-6 overflow-y-auto overflow-x-hidden">
          <p className="px-4 text-[10px] font-medium text-gray-400 uppercase tracking-widest mb-2">Platform</p>
          {links.map((link) => {
            const isRestaurantTab = link.name === 'Restaurant Management';
            const isActive = isRestaurantTab
              ? (location.pathname.includes('/admin/restaurants') || location.pathname.includes('/admin/billing') || location.pathname.includes('/admin/plans'))
              : (location.pathname.includes(link.path) && (link.path !== '/admin' || location.pathname === '/admin'));

            return (
              <Link 
                key={link.path}
                to={link.path}
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setIsSidebarOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-sm)] text-sm font-medium transition-colors ${
                  isActive ? 'bg-[var(--color-primary-light)] text-white' : 'text-gray-300 hover:bg-[var(--color-primary-light)] hover:text-white'
                }`}
                title={link.name}
              >
                <div className="shrink-0">{link.icon}</div>
                <span className="whitespace-nowrap">{link.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-[var(--color-primary-light)]">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white w-full transition-colors text-sm font-medium" title="Logout">
            <div className="shrink-0"><LogOut size={18} /></div>
            <span className="whitespace-nowrap">Logout</span>
          </button>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full relative">
        <header className="bg-white h-16 border-b border-[var(--color-border)] flex items-center px-4 lg:px-8 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-2 text-[var(--color-text-muted)] hover:bg-[var(--color-background)] rounded-[var(--radius-sm)] transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-serif font-bold text-[var(--color-text)] truncate">Super Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] flex items-center justify-center text-[var(--color-text)] font-serif font-bold text-sm">
              SA
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
