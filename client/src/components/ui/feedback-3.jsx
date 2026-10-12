import React, { useState } from 'react';
import { Star, Check, Sparkles, Send, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_REASONS_HIGH = [
  'Delicious Food',
  'Quick Service',
  'Friendly Staff',
  'Great Ambiance',
  'Clean & Hygienic',
  'Value for Money',
  'Accurate Order'
];

const DEFAULT_REASONS_LOW = [
  'Delayed Service',
  'Food was Cold',
  'Taste / Flavor Issue',
  'Missing Item',
  'Portion Size',
  'High Noise Level',
  'Pricing Issue'
];

const RATING_LABELS = {
  1: 'Disappointing',
  2: 'Needs Improvement',
  3: 'Average',
  4: 'Very Good',
  5: 'Exceptional!'
};

/**
 * Feedback 3 Block (React Bits Pro style)
 * Interactive Star Rating with dynamic Contextual Reason Chips
 */
export default function Feedback3({
  title = "How was your experience?",
  description = "Your honest review helps us serve you better.",
  restaurantName,
  tableLabel,
  reasonsHigh = DEFAULT_REASONS_HIGH,
  reasonsLow = DEFAULT_REASONS_LOW,
  initialRating = 0,
  onSubmit,
  className
}) {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeRating = hoverRating || rating;
  const isHighRating = activeRating >= 4;
  const availableReasons = isHighRating ? reasonsHigh : reasonsLow;

  const handleRatingClick = (score) => {
    setRating(score);
    // When changing between high and low sentiment, prune invalid reasons
    setSelectedReasons((prev) => {
      const targetPool = score >= 4 ? reasonsHigh : reasonsLow;
      return prev.filter(r => targetPool.includes(r));
    });
  };

  const toggleReason = (reason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!rating) return;
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit({
          rating,
          reasons: selectedReasons,
          comments,
          sentiment: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-lg mx-auto bg-white rounded-3xl border border-gray-100 shadow-xl shadow-emerald-950/5 p-6 md:p-8 transition-all",
        className
      )}
    >
      {/* Header */}
      <div className="text-center space-y-2 mb-6">
        {(restaurantName || tableLabel) && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100/80 mb-1">
            <Sparkles size={13} className="text-emerald-600" />
            <span>{restaurantName || 'Dynease Restaurant'}</span>
            {tableLabel && <span className="opacity-60">• {tableLabel}</span>}
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight font-serif">
          {title}
        </h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* Star Rating Section */}
      <div className="flex flex-col items-center justify-center my-6">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-gray-50/70 border border-gray-100">
          {[1, 2, 3, 4, 5].map((score) => {
            const isFilled = score <= activeRating;
            return (
              <button
                key={score}
                type="button"
                onClick={() => handleRatingClick(score)}
                onMouseEnter={() => setHoverRating(score)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={`Rate ${score} of 5 stars`}
                className={cn(
                  "p-2 rounded-xl transition-all duration-200 transform hover:scale-115 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  isFilled ? "text-amber-400 drop-shadow-sm" : "text-gray-300 hover:text-amber-200"
                )}
              >
                <Star
                  size={36}
                  className={cn(
                    "transition-transform",
                    isFilled && "fill-amber-400 stroke-amber-400"
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Dynamic Sentiment Label */}
        <div className="h-6 mt-3 flex items-center justify-center">
          {activeRating > 0 ? (
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full transition-all animate-in fade-in zoom-in-95",
                activeRating >= 4
                  ? "bg-emerald-100 text-emerald-800"
                  : activeRating === 3
                  ? "bg-amber-100 text-amber-800"
                  : "bg-rose-100 text-rose-800"
              )}
            >
              {RATING_LABELS[activeRating]}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Tap a star to rate</span>
          )}
        </div>
      </div>

      {/* Reason Chips Section (Displays smoothly after rating is selected) */}
      {rating > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              {rating >= 4 ? "What made it great?" : "What could be improved?"}
            </span>
            <span className="text-gray-400 text-[11px]">Select all that apply</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {availableReasons.map((reason) => {
              const isSelected = selectedReasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => toggleReason(reason)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 border cursor-pointer select-none",
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20 scale-[1.02]"
                      : "bg-gray-50/80 text-gray-700 border-gray-200/80 hover:bg-gray-100/80 hover:border-gray-300"
                  )}
                >
                  {isSelected && <Check size={12} className="stroke-[3]" />}
                  <span>{reason}</span>
                </button>
              );
            })}
          </div>

          {/* Optional Detailed Comments Textarea */}
          <div className="pt-3">
            <textarea
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Any additional thoughts or special mentions? (Optional)"
              className="w-full bg-gray-50/70 border border-gray-200/90 rounded-2xl p-3.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* Submit Action */}
          <button
            type="button"
            disabled={!rating || isSubmitting}
            onClick={handleSubmit}
            className={cn(
              "w-full mt-2 py-3.5 px-5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all",
              "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] shadow-emerald-700/20 cursor-pointer",
              "disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
            )}
          >
            {isSubmitting ? (
              <span>Submitting...</span>
            ) : (
              <>
                <span>Submit Feedback</span>
                <Send size={15} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
