import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader2,
  QrCode,
  MapPin,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  User,
  ArrowRight
} from 'lucide-react';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';

export default function QRMenuLoader() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { saveSession } = useRestaurant();

  // Step states: 'requesting_location' | 'verifying' | 'collect_details' | 'allocating' | 'success' | 'occupied' | 'out_of_range' | 'location_error' | 'error'
  const [step, setStep] = useState('requesting_location');
  const [coords, setCoords] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [restaurantData, setRestaurantData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form details
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');

  // ── Step 1: Request Geolocation & Verify Proximity ─────────────────────────
  const requestLocationAndVerify = useCallback(() => {
    setStep('requesting_location');
    setErrorMsg('');

    if (!navigator.geolocation) {
      // Fallback: Proceed with verification attempt without coords (backend will check if restaurant requires coords)
      verifyLocation(null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };
        setCoords(userCoords);
        verifyLocation(userCoords.latitude, userCoords.longitude);
      },
      (err) => {
        console.warn('Geolocation error or denied:', err);
        // Attempt verify without coords; if restaurant has geofence it will return LOCATION_REQUIRED
        verifyLocation(null, null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [qrToken]);

  const verifyLocation = async (latitude, longitude) => {
    setStep('verifying');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/tables/verify-location`, {
        method: 'POST',
        headers: getTenantHeaders(),
        credentials: 'include',
        body: JSON.stringify({ qrToken, latitude, longitude })
      });
      const data = await res.json();

      if (res.status === 409 || data.code === 'TABLE_OCCUPIED') {
        setStep('occupied');
        return;
      }

      if (res.status === 403 && data.code === 'LOCATION_OUT_OF_RANGE') {
        setErrorMsg(data.message || 'You are outside the permitted 50-metre radius of the restaurant.');
        setStep('out_of_range');
        return;
      }

      if (res.status === 400 && data.code === 'LOCATION_REQUIRED') {
        setErrorMsg(data.message || 'Location permission is required to verify table proximity. Please allow location access in your browser settings.');
        setStep('location_error');
        return;
      }

      if (data.code === 'RESTAURANT_LOCATION_NOT_SET') {
        setErrorMsg(data.message || 'Restaurant location has not been configured by the admin yet.');
        setStep('location_error');
        return;
      }

      if (data.code === 'RESTAURANT_MISMATCH') {
        setErrorMsg(data.message || 'This table QR code belongs to a different restaurant.');
        setStep('error');
        return;
      }

      if (data.success && data.data) {
        setTableData(data.data.table);
        setRestaurantData(data.data.restaurant);
        setStep('collect_details');
      } else {
        setErrorMsg(data.message || 'Invalid or inactive table QR code.');
        setStep('error');
      }
    } catch (err) {
      setErrorMsg('Network connection error. Please check your internet connection.');
      setStep('error');
    }
  };

  useEffect(() => {
    requestLocationAndVerify();
  }, [requestLocationAndVerify]);

  // ── Step 2: Validate Phone and Start Session Directly ───────────────────────────
  const handleAllocate = async (e) => {
    if (e) e.preventDefault();
    setFormError('');

    const clean = phone.trim().replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setStep('allocating');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/tables/start-session`, {
        method: 'POST',
        headers: getTenantHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          qrToken,
          phone: phone.trim(),
          name: name.trim() || undefined,
          latitude: coords?.latitude,
          longitude: coords?.longitude
        })
      });
      const data = await res.json();

      if (res.status === 409 || data.code === 'TABLE_OCCUPIED') {
        setStep('occupied');
        return;
      }

      if (data.success && data.data) {
        try {
          if (phone.trim()) localStorage.setItem('customerPhone', phone.trim());
          if (name.trim()) localStorage.setItem('customerName', name.trim());
        } catch {}
        saveSession(data.data.restaurant, data.data.table, data.data.visitId);
        setStep('success');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1600);
      } else {
        setFormError(data.message || 'Failed to allocate table. Please try again.');
        setStep('collect_details');
      }
    } catch {
      setFormError('Network error. Please try again.');
      setStep('collect_details');
    }
  };

  // ── Render States ─────────────────────────────────────────────────────────

  // 1. Loading / Verifying
  if (step === 'requesting_location' || step === 'verifying' || step === 'allocating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 text-center max-w-sm w-full border border-gray-100">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-green-600">
            {step === 'requesting_location' ? (
              <MapPin size={34} className="animate-bounce" />
            ) : (
              <QrCode size={34} />
            )}
          </div>
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">
            {step === 'requesting_location'
              ? 'Verifying Location…'
              : step === 'verifying'
              ? 'Checking Proximity & Table…'
              : 'Allocating Table…'}
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm">
            {step === 'requesting_location'
              ? 'Requesting browser location to confirm you are at the restaurant.'
              : step === 'verifying'
              ? 'Checking that you are within 50 metres of the restaurant.'
              : 'Preparing your secure dining session…'}
          </p>
        </div>
      </div>
    );
  }

  // 2. Table Occupied
  if (step === 'occupied') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 max-w-sm w-full border border-amber-200">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={34} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Table Occupied</h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">
            This table is currently occupied. Please choose another table or contact a waiter.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            <RefreshCw size={16} /> Check Again
          </button>
        </div>
      </div>
    );
  }

  // 3. Location Out of Range (> 50m)
  if (step === 'out_of_range' || step === 'location_error') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 max-w-sm w-full border border-red-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin size={34} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {step === 'location_error' ? 'Location Access Required' : 'Outside Restaurant Area'}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            {errorMsg || 'You must be within 50 metres of the restaurant to allocate a table and start ordering.'}
          </p>
          <button
            onClick={requestLocationAndVerify}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-sm"
          >
            <RefreshCw size={16} /> Retry Verification
          </button>
        </div>
      </div>
    );
  }

  // 4. Collect Customer Details (Mandatory Mobile, Optional Name)
  if (step === 'collect_details' && tableData && restaurantData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 max-w-md w-full border border-gray-100">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">{restaurantData.name}</h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full mt-1 border border-green-200">
                <CheckCircle2 size={13} /> Within 50m Verified {tableData.distanceMeters !== undefined && tableData.distanceMeters !== null ? `(${tableData.distanceMeters}m away)` : ''}
              </span>
            </div>
            <div className="bg-green-600 text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-xs">
              Table {tableData.tableNumber}
            </div>
          </div>

          <h3 className="text-base font-bold text-gray-800 mb-1">Start Table Session</h3>
          <p className="text-gray-500 text-xs mb-5">
            Please enter your mobile number. We will associate your visit and orders with this number. No OTP required!
          </p>

          <form onSubmit={handleAllocate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-extrabold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full pl-16 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Your Name <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative flex items-center">
                <User size={18} className="absolute left-3.5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white"
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                {formError}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md cursor-pointer"
            >
              Start Ordering <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 6. Success State
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full border border-green-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={38} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">Table Allocated!</h2>
          <p className="text-xs text-green-700 font-bold mb-3">✓ Proximity verified & session active</p>
          <p className="text-gray-400 text-xs">Opening menu…</p>
        </div>
      </div>
    );
  }

  // 7. General Error State
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full border border-red-100">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <QrCode size={34} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">QR Code Issue</h2>
        <p className="text-gray-500 text-xs mb-6">{errorMsg || 'Could not verify table QR code.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors text-sm"
        >
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    </div>
  );
}
