import React from 'react';
import { Clock, Sparkles } from 'lucide-react';

export default function PastOrders() {
  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Past Orders</h1>
        <p className="text-gray-500 text-sm">Completed and cancelled orders for your tables</p>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center py-16 px-8 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-md w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4 text-amber-600 shadow-inner">
            <Clock size={32} className="animate-pulse" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full mb-3 border border-amber-200">
            <Sparkles size={13} className="text-amber-600" />
            <span>Coming Soon...</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Past Orders Archive</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Past orders archive and history will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
