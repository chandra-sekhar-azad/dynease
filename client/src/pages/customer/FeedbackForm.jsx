import React, { useState } from 'react';
import { CheckCircle, ArrowLeft, Menu as MenuIcon, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import CustomerSidebar from '../../components/customer/CustomerSidebar';
import Feedback3 from '@/components/ui/feedback-3';

export default function FeedbackForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const navigate = useNavigate();
  const { session } = useRestaurant();
  const restaurantName = session?.restaurant?.name || 'Restaurant';
  const tableLabel = session?.table?.tableNumber ? `Table ${session.table.tableNumber}` : null;
  const googleReviewLink = session?.restaurant?.googleReviewLink;

  const handleSubmit = (data) => {
    setSubmittedData(data);
    setSubmitted(true);
  };

  if (submitted) {
    const isHighRating = submittedData?.rating >= 4;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-6 max-w-md mx-auto shadow-2xl relative text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-inner animate-in zoom-in-75 duration-300">
          <CheckCircle size={36} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2 font-serif">Thank You!</h2>
        <p className="text-gray-600 text-sm max-w-xs mb-6 leading-relaxed">
          Your feedback has been received. Thank you for dining with {restaurantName}!
        </p>

        {isHighRating && googleReviewLink && (
          <div className="mb-6 w-full p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-left">
            <p className="text-xs font-semibold text-emerald-900 mb-1">Loved your meal?</p>
            <p className="text-xs text-emerald-700/80 mb-3">
              Help us grow by sharing your 5-star experience on Google Reviews!
            </p>
            <a
              href={googleReviewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
            >
              <span>Review on Google</span>
              <ExternalLink size={14} />
            </a>
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          className="text-emerald-700 font-bold hover:underline flex items-center gap-2 text-sm cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Menu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto shadow-2xl relative flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white px-4 py-4 sticky top-0 z-20 shadow-xs flex items-center border-b border-gray-100 gap-3">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1 -ml-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Open sidebar"
        >
          <MenuIcon size={24} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-extrabold text-gray-900 font-serif">Feedback</h1>
      </header>

      {/* Main Feedback Content */}
      <main className="p-4 sm:p-6 flex-1 flex flex-col justify-center">
        <Feedback3
          title="Rate your experience"
          description={`How was your dining experience at ${restaurantName}?`}
          restaurantName={restaurantName}
          tableLabel={tableLabel}
          onSubmit={handleSubmit}
        />
      </main>

      <CustomerSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        tableLabel={tableLabel} 
      />
    </div>
  );
}
