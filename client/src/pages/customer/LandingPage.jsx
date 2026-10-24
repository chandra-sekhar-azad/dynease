import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Keyboard, Loader2 } from 'lucide-react';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';
import CameraQRScanner from '../../components/common/CameraQRScanner';

export default function LandingPage({ onSessionEstablished }) {
  // Default to 'scan' so camera permission is requested immediately upon opening
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

          <div className="p-4 sm:p-6">
            {activeTab === 'scan' ? (
              <CameraQRScanner
                onSwitchToManual={() => setActiveTab('code')}
              />
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
