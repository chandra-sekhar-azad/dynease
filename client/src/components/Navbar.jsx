import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Utensils } from 'lucide-react';

export default function Navbar({ minimal = false }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className={`flex justify-between items-center px-5 md:px-8 py-3 mx-4 mt-4 fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border border-white/50 shadow-sm rounded-full md:w-fit md:mx-auto md:gap-12 ${minimal ? 'border-b border-[var(--color-border)]' : ''}`}>
      <Link to="/" className="text-[24px] font-bold text-[var(--color-text)] tracking-tight flex items-center gap-3">
        <div className="bg-[var(--color-primary)] text-white p-2 rounded-lg flex items-center justify-center">
          <Utensils size={24} />
        </div>
        Dynease
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
          
          <div className="hidden md:flex items-center">
            <Link to="/register" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white px-7 py-2.5 rounded-full text-sm font-medium transition-colors">
              Get Started
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
            <div className="absolute top-full left-0 right-0 bg-white shadow-xl py-6 px-6 flex flex-col gap-6 md:hidden animate-in slide-in-from-top-2 duration-200 border-t border-[var(--color-border)]">
              <NavLink to="/" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-xl pb-2 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>Home</NavLink>
              <NavLink to="/features" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-xl pb-2 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>Features</NavLink>
              <NavLink to="/how-it-works" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-xl pb-2 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>How It Works</NavLink>
              <NavLink to="/pricing" onClick={() => setIsOpen(false)} className={({ isActive }) => `font-medium text-xl pb-2 transition-colors ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:text-[var(--color-primary)]'}`}>Pricing</NavLink>
              <Link to="/register" onClick={() => setIsOpen(false)} className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white text-center px-6 py-4 rounded-full font-medium text-lg mt-2">
                Get Started
              </Link>
            </div>
          )}
        </>
      )}
    </nav>
  );
}
