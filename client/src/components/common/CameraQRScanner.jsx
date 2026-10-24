import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  AlertTriangle,
  RefreshCw,
  Flashlight,
  SwitchCamera,
  X,
  Keyboard,
  CheckCircle2,
  Loader2,
  Sparkles
} from 'lucide-react';

/**
 * CameraQRScanner
 * 
 * Automatically requests camera permission on mount and initializes a fast,
 * high-accuracy QR code scanner for Dynease table ordering.
 * 
 * Props:
 * - isModal: boolean (renders as a floating/fullscreen modal with backdrop)
 * - onClose: function (called when user dismisses the modal)
 * - onScanSuccess: optional custom callback when a QR is scanned
 * - onSwitchToManual: optional callback to switch to manual table code input
 */
export default function CameraQRScanner({
  isModal = false,
  onClose,
  onScanSuccess,
  onSwitchToManual
}) {
  const navigate = useNavigate();
  const readerId = useRef(`dynease-scanner-${Math.random().toString(36).substring(2, 9)}`).current;
  const scannerRef = useRef(null);

  // States: 'requesting' | 'active' | 'scanned' | 'denied' | 'unsupported' | 'error'
  const [status, setStatus] = useState('requesting');
  const [errorMessage, setErrorMessage] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Extract clean QR token from any Dynease QR format (full URL, path, or raw token)
  const extractToken = useCallback((decodedText) => {
    if (!decodedText) return null;
    const trimmed = decodedText.trim();
    // Matches https://.../t/<token> or /t/<token> or /menu/<token>
    const urlMatch = trimmed.match(/\/(?:t|menu)\/([^/?#\s]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    // Matches raw token or table code
    return trimmed;
  }, []);

  const handleScanSuccess = useCallback((decodedText) => {
    if (status === 'scanned') return; // Prevent multiple triggers
    setStatus('scanned');

    // Subtle vibration feedback if supported
    try {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {}

    const token = extractToken(decodedText);

    // Stop scanner track
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(() => {});
      } catch {}
    }

    if (onScanSuccess) {
      onScanSuccess(token, decodedText);
    } else if (token) {
      setTimeout(() => {
        navigate(`/t/${token}`);
      }, 600);
    }
  }, [status, extractToken, onScanSuccess, navigate]);

  // Start Scanner
  const startCamera = useCallback(async (cameraId = null) => {
    setStatus('requesting');
    setErrorMessage('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('unsupported');
      setErrorMessage('Your browser or device does not support camera access. Please use a modern browser over HTTPS.');
      return;
    }

    try {
      // Clean up any existing scanner instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {}
      }

      // First check available cameras
      try {
        const availableDevices = await Html5Qrcode.getCameras();
        if (availableDevices && availableDevices.length > 0) {
          setCameras(availableDevices);
        }
      } catch {}

      const html5QrCode = new Html5Qrcode(readerId);
      scannerRef.current = html5QrCode;

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' }; // Default to back camera for QR scanning

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrEdge = Math.max(200, Math.floor(minEdge * 0.72));
            return { width: qrEdge, height: qrEdge };
          },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame parsed with no QR detected — normal during continuous scan
        }
      );

      setStatus('active');

      // Check if torch/flashlight capability is available
      try {
        const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
        if (capabilities && capabilities.torchFeature().isSupported()) {
          setHasTorch(true);
        }
      } catch {}

    } catch (err) {
      console.warn('[CameraQRScanner] Camera start failed:', err);
      const errName = err?.name || '';
      const errMsg = err?.message || String(err);

      if (errName === 'NotAllowedError' || errMsg.includes('Permission') || errMsg.includes('denied')) {
        setStatus('denied');
        setErrorMessage('Camera permission was blocked. Please tap "Allow" in your browser settings to scan the table QR code.');
      } else if (errName === 'NotFoundError' || errMsg.includes('no camera') || errMsg.includes('not found')) {
        setStatus('unsupported');
        setErrorMessage('No camera was detected on this device. You can enter the table code manually below.');
      } else {
        setStatus('error');
        setErrorMessage(errMsg || 'Failed to initialize camera. Please try again.');
      }
    }
  }, [readerId, handleScanSuccess]);

  // Mount effect: immediately trigger camera permission request & start scanning
  useEffect(() => {
    let mounted = true;

    // Small delay to ensure the DOM element with readerId is mounted
    const timer = setTimeout(() => {
      if (mounted) {
        startCamera();
      }
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {}).finally(() => {
              scannerRef.current?.clear();
            });
          } else {
            scannerRef.current.clear();
          }
        } catch {}
      }
    };
  }, [startCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Switch between available cameras
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const nextIdx = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIdx);
    startCamera(cameras[nextIdx].id);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const token = extractToken(manualCode);
    if (onScanSuccess) {
      onScanSuccess(token, manualCode);
    } else {
      navigate(`/t/${token}`);
    }
  };

  const scannerContent = (
    <div className="relative w-full flex flex-col items-center select-none">
      {/* 1. Header Bar */}
      <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-white/10 text-white z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
            <Camera size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Scan Table QR</span>
              {status === 'active' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </h3>
            <p className="text-[11px] text-gray-400">Point your camera at the QR code</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Torch toggle if available */}
          {hasTorch && status === 'active' && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-xl border transition-colors ${
                torchOn
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                  : 'bg-white/10 border-white/15 text-gray-300 hover:text-white hover:bg-white/15'
              }`}
              title="Toggle Flashlight"
            >
              <Flashlight size={16} />
            </button>
          )}

          {/* Switch Camera if multiple cameras available */}
          {cameras.length > 1 && status === 'active' && (
            <button
              type="button"
              onClick={switchCamera}
              className="p-2 rounded-xl bg-white/10 border border-white/15 text-gray-300 hover:text-white hover:bg-white/15 transition-colors"
              title="Switch Camera"
            >
              <SwitchCamera size={16} />
            </button>
          )}

          {/* Close button if modal */}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-colors"
              title="Close Scanner"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Viewfinder / Reader Box */}
      <div className="relative w-full aspect-square max-w-[340px] rounded-3xl overflow-hidden bg-black/90 border-2 border-emerald-500/40 shadow-2xl flex items-center justify-center">
        {/* DOM target for Html5Qrcode video */}
        <div
          id={readerId}
          className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
        />

        {/* Dynamic laser scanline & corner guides during active scanning */}
        {status === 'active' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            {/* Viewfinder Target Reticle */}
            <div className="relative w-[72%] h-[72%] border border-emerald-500/30 rounded-2xl">
              {/* Corner 1: Top-Left */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-lg" />
              {/* Corner 2: Top-Right */}
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-lg" />
              {/* Corner 3: Bottom-Left */}
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-lg" />
              {/* Corner 4: Bottom-Right */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-lg" />

              {/* Glowing animated scan laser */}
              <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-scanner-laser" />
            </div>

            {/* Hint Chip */}
            <div className="absolute bottom-4 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-emerald-300 shadow-md">
              Align QR Code Inside Box
            </div>
          </div>
        )}

        {/* State A: Requesting Camera Permission */}
        {status === 'requesting' && (
          <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="relative w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg">
              <Camera size={32} className="animate-pulse" />
              <div className="absolute -inset-1 rounded-2xl border border-emerald-400/20 animate-ping" />
            </div>
            <Loader2 size={24} className="text-emerald-400 animate-spin mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">Requesting Camera Permission</h4>
            <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
              Please click <strong>&quot;Allow&quot;</strong> when your browser asks to use the camera.
            </p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              Grant Camera Permission
            </button>
          </div>
        )}

        {/* State B: Scanned Successfully */}
        {status === 'scanned' && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-base font-extrabold text-white mb-1">QR Code Detected!</h4>
            <p className="text-xs text-emerald-200 font-medium">Opening table menu…</p>
          </div>
        )}

        {/* State C: Permission Denied */}
        {status === 'denied' && (
          <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 mb-3">
              <AlertTriangle size={28} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Camera Permission Blocked</h4>
            <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed mb-4">
              Camera access was denied. Please allow camera permissions in your browser address bar (tap the lock / settings icon).
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[220px]">
              <button
                type="button"
                onClick={() => startCamera()}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
              >
                <RefreshCw size={14} /> Retry Permission
              </button>
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="w-full py-2 bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Enter Code Manually
              </button>
            </div>
          </div>
        )}

        {/* State D: Unsupported / Error */}
        {(status === 'unsupported' || status === 'error') && (
          <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-400/30 flex items-center justify-center text-red-400 mb-3">
              <AlertTriangle size={28} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Camera Unavailable</h4>
            <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed mb-4">
              {errorMessage || 'Unable to access camera.'}
            </p>
            <button
              type="button"
              onClick={() => setShowManualInput(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Enter Table Code Manually
            </button>
          </div>
        )}
      </div>

      {/* 3. Manual Fallback & Toggle */}
      <div className="w-full mt-4 flex flex-col items-center text-center">
        {!showManualInput ? (
          <button
            type="button"
            onClick={() => {
              if (onSwitchToManual) {
                onSwitchToManual();
              } else {
                setShowManualInput(true);
              }
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 py-1.5 px-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <Keyboard size={14} />
            <span>Having trouble? Enter table code manually</span>
          </button>
        ) : (
          <form onSubmit={handleManualSubmit} className="w-full max-w-[340px] mt-1 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter Table Token or Code"
                className="flex-1 px-3.5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
              >
                Go
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowManualInput(false)}
              className="text-[11px] text-gray-400 hover:text-white"
            >
              ← Back to camera view
            </button>
          </form>
        )}
      </div>

      {/* Keyframe animation for scanning laser */}
      <style>{`
        @keyframes scannerLaser {
          0% { top: 12%; opacity: 0.2; }
          50% { opacity: 1; }
          100% { top: 86%; opacity: 0.2; }
        }
        .animate-scanner-laser {
          animation: scannerLaser 1.8s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-sm bg-gradient-to-b from-gray-900 via-gray-950 to-black border border-white/15 rounded-3xl p-5 shadow-2xl overflow-hidden">
          {/* Subtle ambient lighting */}
          <div className="absolute -top-20 -right-20 w-44 h-44 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
          {scannerContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-gray-900 via-gray-950 to-black border border-white/15 rounded-3xl p-5 shadow-2xl overflow-hidden">
      {scannerContent}
    </div>
  );
}
