import React, { useEffect } from 'react';
import { useRestaurant } from '../../context/RestaurantContext';
import { ArrowLeft, Star, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GoogleReview() {
  const { session } = useRestaurant();
  const navigate = useNavigate();
  const googleReviewLink = session?.restaurant?.googleReviewLink;

  useEffect(() => {
    if (googleReviewLink) {
      window.location.href = googleReviewLink;
    }
  }, [googleReviewLink]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto shadow-2xl relative text-center">
      <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6">
        <Star size={32} />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Google Review</h1>

      {googleReviewLink ? (
        <div>
          <p className="text-gray-600 mb-6">Redirecting you to Google Reviews...</p>
          <a
            href={googleReviewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
          >
            Open Review Page <ExternalLink size={18} />
          </a>
        </div>
      ) : (
        <div>
          <p className="text-gray-600 mb-6">
            The restaurant has not configured a Google Review link yet.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-green-600 font-bold hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Back to Menu
          </button>
        </div>
      )}
    </div>
  );
}
