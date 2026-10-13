import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Utensils, Megaphone } from 'lucide-react';

export default function Navbar({ minimal = false }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className={`flex justify-between items-center px-5 md:px-8 py-3 mx-4 mt-4 fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm rounded-full md:w-fit md:mx-auto md:gap-12 ${minimal ? 'border-b border-[var(--color-border)]' : ''}`}>
      <Link to="/" className="flex items-center gap-2.5">
        <img
          src="/brand/logo-horizontal.svg"
          alt="Dynease Logo"
          className="h-8 md:h-9 w-auto object-contain"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/brand/logo-horizontal.png';
          }}
        />
      </Link>

      {minimal ? (
        <Link to="/" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] text-sm font-medium transition-colors">
          Back to Home
        </Link>
      ) : (
        <>
          {/* Desktop menu */}
          <div className="hidden md:flex gap-8 items-center">
            <NavLink to="/" className={({ isActive }) => `text-sm font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]'}`}>Home</NavLink>
            <NavLink to="/features" className={({ isActive }) => `text-sm font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]'}`}>Features</NavLink>
            <NavLink to="/how-it-works" className={({ isActive }) => `text-sm font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]'}`}>How It Works</NavLink>
            <NavLink to="/pricing" className={({ isActive }) => `text-sm font-medium transition-colors pb-1 border-b-2 ${isActive ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]'}`}>Pricing</NavLink>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/advertise"
              className="border border-emerald-600/30 hover:border-emerald-600 bg-emerald-50/60 hover:bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Megaphone size={14} className="text-emerald-600" />
              <span>Advertise Here</span>
            </Link>
            <Link to="/register" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm">
              Register Your Restaurant
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          {/* Mobile menu overlay */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 bg-white shadow-xl py-6 px-6 flex flex-col gap-4 md:hidden animate-in slide-in-from-top-2 duration-200 border-t border-[var(--color-border)]">
              <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-lg pb-1 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>Home</NavLink>
              <NavLink to="/features" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-lg pb-1 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>Features</NavLink>
              <NavLink to="/how-it-works" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-lg pb-1 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>How It Works</NavLink>
              <NavLink to="/pricing" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-lg pb-1 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>Pricing</NavLink>
              <Link to="/advertise" onClick={() => setIsOpen(false)} className="flex items-center justify-center gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 py-3 rounded-full font-semibold text-base mt-1">
                <Megaphone size={18} className="text-emerald-600" /> Advertise Here
              </Link>
              <Link to="/register" onClick={() => setIsOpen(false)} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-center px-6 py-3.5 rounded-full font-medium text-base">
                Register Your Restaurant
              </Link>
            </div>
          )}
        </>
      )}
    </nav>
  );
}

