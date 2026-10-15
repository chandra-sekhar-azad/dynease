import React from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';

export default function CustomerSidebar({ isOpen, onClose, tableLabel, googleReviewLink, onOpenServiceRequest }) {
  const { liveOrdersCount } = useRestaurant();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-start">
      <div className="w-64 bg-white h-full shadow-2xl flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-extrabold text-gray-900 text-lg">Menu</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4 flex-1">
          <Link to="/" onClick={onClose} className="block text-gray-700 font-bold hover:text-emerald-600 transition-colors">Home / Menu</Link>
          <Link to="/cart" onClick={onClose} className="block text-gray-700 font-bold hover:text-emerald-600 transition-colors">Your Cart</Link>
          <Link
            to="/orders"
            onClick={onClose}
            className="flex items-center justify-between text-gray-700 font-bold hover:text-emerald-600 transition-colors"
          >
            <span>My Orders</span>
            {liveOrdersCount > 0 && (
              <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                {liveOrdersCount} Live
              </span>
            )}
          </Link>
          {onOpenServiceRequest && (
            <button
              onClick={() => {
                onClose();
                onOpenServiceRequest();
              }}
              className="w-full text-left font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-2.5 rounded-xl border border-emerald-200 transition-colors flex items-center justify-between"
            >
              <span>Call Waiter / Service</span>
              <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">Quick</span>
            </button>
          )}
          <Link to="/feedback" onClick={onClose} className="block text-gray-700 font-bold hover:text-emerald-600 transition-colors">Leave Feedback</Link>
          {googleReviewLink ? (
            <a 
              href={googleReviewLink} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={onClose} 
              className="block text-gray-700 font-bold hover:text-green-600 transition-colors"
            >
              Google Review
            </a>
          ) : (
            <Link 
              to="/google-review" 
              onClick={onClose} 
              className="block text-gray-700 font-bold hover:text-green-600 transition-colors"
            >
              Google Review
            </Link>
          )}
        </div>
        {tableLabel && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="text-xs text-gray-500 font-semibold mb-1">Currently at</div>
            <div className="font-bold text-gray-800">{tableLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}
