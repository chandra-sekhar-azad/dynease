import React, { useState, useEffect } from 'react';
import { 
  Loader2, Lock, KeyRound, Eye, EyeOff, 
  CheckCircle2, AlertCircle, ShieldCheck, Settings as SettingsIcon,
  MapPin, Navigation, ExternalLink, Compass
} from 'lucide-react';
import { getTenantHeaders } from '../../context/RestaurantContext';

export default function RestaurantSettings() {
  // Password Management State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Location & Geofencing State
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [geofenceRadius, setGeofenceRadius] = useState(50);
  const [profileLoading, setProfileLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState('');
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/profile`, {
        headers: getTenantHeaders()
      });
      const data = await res.json();
      if (data.success && data.data?.profile) {
        const p = data.data.profile;
        setAddress(p.address || '');
        setLatitude(p.latitude !== null && p.latitude !== undefined ? String(p.latitude) : '');
        setLongitude(p.longitude !== null && p.longitude !== undefined ? String(p.longitude) : '');
        setGeofenceRadius(p.geofenceRadiusMeters || 50);
      }
    } catch (err) {
      console.error('Failed to load restaurant profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setDetectingLocation(true);
    setLocationError('');
    setLocationSuccess('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setLatitude(String(lat));
        setLongitude(String(lng));
        setDetectingLocation(false);
        setLocationSuccess(`Current GPS coordinates detected (±${Math.round(pos.coords.accuracy || 0)}m accuracy). Click "Save Restaurant Location" to store.`);
      },
      (err) => {
        setDetectingLocation(false);
        setLocationError(`Could not detect location: ${err.message || 'Permission denied'}. Please allow browser location access or enter coordinates manually.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setLocationLoading(true);
    setLocationError('');
    setLocationSuccess('');

    if (!latitude || !longitude) {
      setLocationError('Please provide both latitude and longitude coordinates.');
      setLocationLoading(false);
      return;
    }

    const pLat = parseFloat(latitude);
    const pLng = parseFloat(longitude);
    if (isNaN(pLat) || pLat < -90 || pLat > 90) {
      setLocationError('Latitude must be a valid number between -90 and 90.');
      setLocationLoading(false);
      return;
    }
    if (isNaN(pLng) || pLng < -180 || pLng > 180) {
      setLocationError('Longitude must be a valid number between -180 and 180.');
      setLocationLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/profile`, {
        method: 'PUT',
        headers: getTenantHeaders(),
        body: JSON.stringify({
          address: address.trim(),
          latitude: pLat,
          longitude: pLng,
          geofenceRadiusMeters: parseInt(geofenceRadius, 10) || 50
        })
      });
      const data = await res.json();
      if (data.success) {
        setLocationSuccess('Restaurant location and 50-metre geofence saved successfully in database!');
        if (data.data?.profile) {
          const p = data.data.profile;
          setAddress(p.address || '');
          setLatitude(p.latitude !== null && p.latitude !== undefined ? String(p.latitude) : '');
          setLongitude(p.longitude !== null && p.longitude !== undefined ? String(p.longitude) : '');
          setGeofenceRadius(p.geofenceRadiusMeters || 50);
        }
        setTimeout(() => setLocationSuccess(''), 6000);
      } else {
        setLocationError(data.message || 'Failed to update restaurant location.');
      }
    } catch (err) {
      console.error('Save location error:', err);
      setLocationError('Network error while saving restaurant location.');
    } finally {
      setLocationLoading(false);
    }
  };

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
        headers: getTenantHeaders(),
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

  const isGeofenceActive = Boolean(latitude && longitude);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 bg-white p-4 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="p-2.5 sm:p-3 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
          <SettingsIcon size={22} className="sm:w-6 sm:h-6" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-serif text-gray-900 tracking-tight">Restaurant Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage your physical restaurant location, 50-metre QR geofence, and security credentials.</p>
        </div>
      </div>

      {/* ── CARD 1: Restaurant Location & 50m Geofencing ── */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <MapPin size={18} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Restaurant Location & 50m Geofence</h2>
              <p className="text-[11px] sm:text-xs text-gray-500">Required so customer table QR scans accurately verify proximity within 50 metres.</p>
            </div>
          </div>
          <div>
            {isGeofenceActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                <CheckCircle2 size={13} className="text-green-600" />
                <span>50m Geofence Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <AlertCircle size={13} className="text-amber-600" />
                <span>Location Not Configured</span>
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveLocation} className="p-4 sm:p-6 space-y-5">
          {profileLoading ? (
            <div className="py-8 flex justify-center items-center text-gray-400 gap-2">
              <Loader2 className="animate-spin text-emerald-600 w-5 h-5" />
              <span className="text-xs">Loading restaurant coordinates...</span>
            </div>
          ) : (
            <>
              {locationSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{locationSuccess}</span>
                </div>
              )}

              {locationError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}

              {/* Quick Auto-Detect Location Action */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-emerald-900 font-medium">
                  <Compass size={18} className="text-emerald-600 shrink-0" />
                  <span>Are you currently at the restaurant? Click to auto-capture your exact GPS coordinates.</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={detectingLocation}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-60 cursor-pointer"
                  >
                    {detectingLocation ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                    <span>{detectingLocation ? 'Detecting GPS...' : 'Detect Current GPS Location'}</span>
                  </button>
                  {isGeofenceActive && (
                    <a
                      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-emerald-300 hover:bg-emerald-100 text-emerald-700 rounded-xl transition"
                      title="View pinned location on Google Maps"
                    >
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {/* Physical Address */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Restaurant Physical Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 12/4 MG Road, Indiranagar, Bengaluru, Karnataka"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Coordinates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Latitude <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="e.g. 12.971598"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Decimal degrees between -90 and 90.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Longitude <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="e.g. 77.594562"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Decimal degrees between -180 and 180.</p>
                  </div>
                </div>

                {/* Geofence Radius */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Geofence Verification Radius (Metres)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="10"
                      max="200"
                      value={geofenceRadius}
                      onChange={(e) => setGeofenceRadius(e.target.value)}
                      className="w-32 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <span className="text-xs text-gray-500 font-medium">
                      Standard is <strong>50 metres</strong>. Customers scanning table QR codes farther than this radius will be blocked.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={locationLoading}
                  className="w-full sm:w-auto justify-center flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {locationLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  <span>{locationLoading ? 'Saving Location...' : 'Save Restaurant Location'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {/* ── CARD 2: Change Password & Security ── */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200/80 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <KeyRound size={18} />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Change Account Password</h2>
              <p className="text-[11px] sm:text-xs text-gray-500">Update your restaurant owner login credentials.</p>
            </div>
          </div>
          <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
        </div>

        <form onSubmit={handleChangePassword} className="p-4 sm:p-6 space-y-5">
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

          <div className="space-y-4">
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
                  className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    placeholder="Min 6 characters"
                    className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                    className="w-full px-4 py-2.5 pr-11 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full sm:w-auto justify-center flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {passwordLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{passwordLoading ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
