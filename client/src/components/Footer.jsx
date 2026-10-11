import React from 'react';
import { Mail,HeartOff, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer({ className = "" }) {
  return (
    <footer className={`bg-[#06341a] text-white py-12 px-4 md:px-12 border-t border-[#094825] ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <Link to="/" className="text-[24px] font-bold text-white tracking-tight flex items-center gap-3">
          <div className="bg-white text-[#06341a] p-2 rounded-lg flex items-center justify-center">
            <Utensils size={20} />
          </div>
          Dynease
        </Link>
        
        <div className="flex flex-wrap justify-center gap-8 text-sm font-medium">
          <Link to="/" className="hover:text-[#34d399] transition-colors">Home</Link>
          <Link to="/features" className="hover:text-[#34d399] transition-colors">Features</Link>
          <Link to="/how-it-works" className="hover:text-[#34d399] transition-colors">How It Works</Link>
          <Link to="/pricing" className="hover:text-[#34d399] transition-colors">Pricing</Link>
        </div>

        <div className="flex gap-4">
          
    <a
    href="mailto:contact@dynease.in"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center space-x-3 p-3 rounded-xl hover:bg-white/10 transition-all w-full max-w-sm backdrop-blur-sm border border-white/10 shadow-sm"
  >
    <Mail className="w-5 h-5 text-blue-400" />
    <div className="text-left">
      <span className="text-xs text-gray-400 uppercase tracking-wider font-medium block mb-0.5">Email</span>
      <span className="text-sm font-semibold">contact@dynease.in</span>
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
