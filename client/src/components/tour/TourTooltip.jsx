import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Sparkles, Compass } from 'lucide-react';

export default function TourTooltip({
  continuous: _continuous,
  index,
  isLastStep,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
  tooltipProps,
}) {
  const navigate = useNavigate();
  const progressPercent = Math.round(((index + 1) / size) * 100);

  const handleFinish = (e) => {
    if (primaryProps?.onClick) {
      primaryProps.onClick(e);
    }
    navigate('/register');
  };

  return (
    <div
      {...tooltipProps}
      className="bg-white rounded-2xl shadow-2xl border border-emerald-100 max-w-md w-[calc(100vw-2rem)] sm:w-[420px] p-5 sm:p-6 text-gray-800 font-sans z-[1100] animate-in fade-in-50 zoom-in-95 duration-200 select-none relative"
      style={{
        boxShadow: '0 20px 40px -15px rgba(16, 138, 74, 0.25), 0 0 0 1px rgba(16, 138, 74, 0.1)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Compass size={13} className="text-emerald-600 animate-spin-slow" />
            <span>Dynease Product Tour</span>
          </span>
          <span className="text-xs font-medium text-gray-500">
            Step {index + 1} of {size}
          </span>
        </div>

        {/* Close / Skip button */}
        <button
          {...closeProps}
          className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-lg transition-colors"
          aria-label="Close product tour"
          title="Exit Tour"
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-emerald-600 to-green-500 h-1.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Title */}
      {step.title && (
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 leading-snug tracking-tight">
          {step.title}
        </h3>
      )}

      {/* Content */}
      <div className="text-sm text-gray-600 leading-relaxed mb-6">
        {step.content}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
        <div>
          {!isLastStep ? (
            <button
              {...skipProps}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline px-1 py-1.5 transition-colors"
              title="Skip remaining steps"
            >
              Skip Tour
            </button>
          ) : (
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
              <Sparkles size={13} /> Demo Finished
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center gap-1.5 active:scale-95"
              aria-label="Previous tour step"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {isLastStep ? (
            <button
              onClick={handleFinish}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all shadow-md hover:shadow-lg shadow-emerald-700/20 flex items-center gap-1.5 active:scale-95"
              aria-label="Start free trial and register"
            >
              <span>Start Free Trial</span>
              <Sparkles size={14} />
            </button>
          ) : (
            <button
              {...primaryProps}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all shadow-md hover:shadow-lg shadow-emerald-700/20 flex items-center gap-1.5 active:scale-95"
              aria-label="Next tour step"
            >
              <span>Next</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
