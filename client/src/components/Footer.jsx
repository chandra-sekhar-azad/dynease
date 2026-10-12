import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer({ className = "" }) {
  return (
    <footer className={`bg-[#06341a] text-white py-12 px-4 md:px-12 border-t border-[#094825] ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img 
            src="/brand/logo-horizontal-reversed.svg" 
            alt="Dynease" 
            className="h-8 md:h-9 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/brand/logo-horizontal-reversed.png';
            }}
          />
        </Link>
        
        <div className="flex flex-wrap justify-center gap-8 text-sm font-medium">
          <Link to="/" className="hover:text-[#34d399] transition-colors">Home</Link>
          <Link to="/features" className="hover:text-[#34d399] transition-colors">Features</Link>
          <Link to="/how-it-works" className="hover:text-[#34d399] transition-colors">How It Works</Link>
          <Link to="/pricing" className="hover:text-[#34d399] transition-colors">Pricing</Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="mailto:contact@dynease.in"
            className="flex items-center space-x-3 p-3 rounded-xl hover:bg-white/10 transition-all backdrop-blur-sm border border-white/10 shadow-sm"
          >
            <Mail className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium block">Email</span>
              <span className="text-sm font-semibold">contact@dynease.in</span>
            </div>
          </a>

          <a
            href="tel:+918897536435"
            className="flex items-center space-x-3 p-3 rounded-xl hover:bg-white/10 transition-all backdrop-blur-sm border border-white/10 shadow-sm"
          >
            <Phone className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-left">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium block">Phone</span>
              <span className="text-sm font-semibold">+91 88975 36435</span>
            </div>
          </a>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-[#094825] flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
        <p>© {new Date().getFullYear()} Dynease. All rights reserved.</p>
        <h5 className="font-bold text-white hover:text-black-500 transition-colors duration-200"> <a className="text-white hover:text-[#34d399] transition-colors"><a href="https://www.thewebgenixx.in" target="_blank" rel="noopener noreferrer">Designed and Developed by Webgenixx</a></a>❤️</h5>
        <p className="hidden md:block">Smarter Restaurants. Happier Customers.</p>
      </div>
    </footer>
  );
}
