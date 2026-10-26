import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Keyboard, Loader2, Smartphone, Sparkles, CheckCircle2 } from 'lucide-react';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';

export default function LandingPage({ onSessionEstablished }) {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'code'
  const [tableCode, setTableCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { saveSession } = useRestaurant();
  const navigate = useNavigate();

  const handleSubmitCode = async (e) => {
    e.preventDefault();
    if (!tableCode.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/public/table/${tableCode.trim()}`,
        { headers: getTenantHeaders() }
      );
      const data = await res.json();

      if (data.success) {
        const { restaurant, table, session } = data.data;
        saveSession(restaurant, table, session.qrToken);
        if (onSessionEstablished) {
          onSessionEstablished();
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setErrorMsg(data.message || 'Invalid Table Code.');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center p-4 sm:p-6 relative">
      <div className="w-full max-w-sm">
        {/* Logo Area */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif text-[var(--color-text)] mb-2 tracking-wide">Dynease</h1>
          <p className="text-[var(--color-text-muted)] text-sm font-light">Scan table QR code to view menu and order</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-[var(--color-border)] overflow-hidden">
          <div className="flex border-b border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex-1 py-3.5 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                activeTab === 'scan' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]'
              }`}
            >
              <QrCode size={16} /> Scan QR
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-3.5 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-colors border-l border-[var(--color-border)] cursor-pointer ${
                activeTab === 'code' ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-[var(--color-background)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-background)]'
              }`}
            >
              <Keyboard size={16} /> Enter Code
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'scan' ? (
              <div className="flex flex-col items-center text-center py-4 px-2">
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-xs relative">
                  <QrCode size={38} />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white p-1 rounded-full shadow-xs">
                    <Smartphone size={12} />
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 mb-2">Scan with Google Lens or Camera</h3>
                <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                  Use your phone camera or Google Lens to scan the QR standee on your table. It will directly allocate your table and open the menu.
                </p>

                <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-left space-y-2 mb-6">
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Point phone camera or Google Lens at table QR</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>Tap the link to open menu with your table allocated</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className="w-full py-3 px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Keyboard size={16} /> Enter Table Code Instead
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitCode} className="p-2">
                <div className="mb-6">
                  <label className="block text-[var(--color-text)] text-xs font-bold uppercase tracking-wider mb-2">Table Code</label>
                  <input
                    type="text"
                    value={tableCode}
                    onChange={(e) => setTableCode(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-serif text-lg text-center transition-colors font-bold"
                    required
                    autoFocus
                  />
                </div>
                {errorMsg && <p className="text-red-700 bg-red-50 p-3 rounded-xl text-xs mb-5 font-bold text-center border border-red-200">{errorMsg}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[var(--color-primary)] text-white font-bold text-xs tracking-wider uppercase py-3.5 rounded-xl hover:bg-[var(--color-primary-light)] transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Open Menu'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
