import React, { useState, useEffect } from 'react';
import { 
  KeyRound, Lock, Eye, EyeOff, Loader2, CheckCircle2, 
  AlertCircle, ShieldCheck, User, Settings as SettingsIcon 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WaiterSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    const hostname = window.location.hostname;
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    let subdomain = '';
    if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in') {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('localhost') && hostname !== 'localhost') {
      subdomain = hostname.split('.')[0];
    }
    if (subdomain) headers['x-tenant-subdomain'] = subdomain;
    return headers;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchMe = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, { headers: getHeaders() });
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
        }
      } catch (err) {
        console.error('Failed to fetch waiter profile', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [navigate]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/change-password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const data = await res.json();
      if (data.success) {
        setPasswordSuccess(data.message || 'Your password has been changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 6000);
      } else {
        setPasswordError(data.message || 'Failed to update password. Please check your current password.');
      }
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordError('Network error while changing password. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-green-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ── Header ── */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl">
            <SettingsIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Settings</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your waiter credentials and account security</p>
          </div>
        </div>

        {user && (
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-gray-800">{user.name}</p>
            <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-extrabold border border-green-200">
              {user.role?.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {/* ── Change Password Card ── */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-green-100 text-green-700">
              <KeyRound size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">Update your personal waiter login password</p>
            </div>
          </div>
          <ShieldCheck size={20} className="text-emerald-600" />
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          {passwordSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={passwordLoading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {passwordLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{passwordLoading ? 'Updating Password...' : 'Save New Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
