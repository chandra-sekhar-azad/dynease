import React, { useState } from 'react';
import { Bell, Droplets, Utensils, Receipt, Sparkles, HelpCircle, X, CheckCircle, Loader2 } from 'lucide-react';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';

const REQUEST_TYPES = [
  { id: 'CALL_WAITER', label: 'Call Waiter', desc: 'Ask a server to come by', icon: Bell },
  { id: 'WATER', label: 'Water', desc: 'Refill drinking water', icon: Droplets },
  { id: 'CUTLERY', label: 'Cutlery', desc: 'Forks, spoons, napkins', icon: Utensils },
  { id: 'BILL', label: 'Request Bill', desc: 'Ready for check & payment', icon: Receipt },
  { id: 'CLEANING', label: 'Clean Table', desc: 'Clear used plates or wipe table', icon: Sparkles },
  { id: 'OTHER', label: 'Other', desc: 'Any special request', icon: HelpCircle },
];

export default function ServiceRequestModal({ isOpen, onClose }) {
  const { session } = useRestaurant();
  const [selectedType, setSelectedType] = useState('CALL_WAITER');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.table?.tableId && !session?.table?.id) {
      setErrorMsg('No active table detected. Please scan a table QR code.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const tableId = session.table.tableId || session.table.id;
      const headers = getTenantHeaders();

      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/service-requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tableId,
          type: selectedType,
          note: note.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Request sent! Your server has been notified.');
        setNote('');
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 2200);
      } else {
        setErrorMsg(data.message || 'Failed to submit service request.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-green-700 text-white">
          <div className="flex items-center gap-2">
            <Bell size={20} className="animate-bounce" />
            <div>
              <h3 className="font-bold text-base leading-tight">Need Assistance?</h3>
              <p className="text-xs text-emerald-100">
                Table {session?.table?.tableNumber || ''} • Instant Service
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {successMsg ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle size={48} className="text-emerald-500 mx-auto animate-pulse" />
              <p className="text-base font-bold text-gray-800">{successMsg}</p>
              <p className="text-xs text-gray-500">A waiter will assist you right away.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Select Request Type
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {REQUEST_TYPES.map(t => {
                    const Icon = t.icon;
                    const isSelected = selectedType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedType(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'border-gray-200 hover:border-gray-300 bg-white text-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon size={18} className={isSelected ? 'text-emerald-600' : 'text-gray-500'} />
                          {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                        </div>
                        <span className="font-semibold text-xs mt-1">{t.label}</span>
                        <span className="text-[10px] text-gray-500 leading-tight">{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra ice, warm water, lemon..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={120}
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Bell size={14} />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
