import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  AlertTriangle, CheckCircle2, AlertCircle, Info, 
  HelpCircle, Trash2, X 
} from 'lucide-react';

const DialogContext = createContext(null);

// Global bridge holders so components can call showToast / showConfirm directly
let globalShowConfirm = null;
let globalShowAlert = null;
let globalShowToast = null;

export const showConfirm = (options) => {
  if (globalShowConfirm) {
    return globalShowConfirm(options);
  }
  // Fallback if context not mounted yet
  return Promise.resolve(window.confirm(typeof options === 'string' ? options : options.message));
};

export const showAlert = (options) => {
  if (globalShowAlert) {
    return globalShowAlert(options);
  }
  if (globalShowToast) {
    globalShowToast(typeof options === 'string' ? options : options.message, 'info');
    return Promise.resolve();
  }
  return Promise.resolve();
};

export const showToast = (message, type = 'info', duration = 3500) => {
  if (globalShowToast) {
    return globalShowToast(message, type, duration);
  }
  console.log(`[Toast ${type}] ${message}`);
};

export const toast = {
  success: (msg, duration) => showToast(msg, 'success', duration),
  error: (msg, duration) => showToast(msg, 'error', duration),
  warning: (msg, duration) => showToast(msg, 'warning', duration),
  info: (msg, duration) => showToast(msg, 'info', duration),
};

export function DialogProvider({ children }) {
  // Confirm state: { isOpen, title, message, confirmText, cancelText, type, resolve }
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Alert state: { isOpen, title, message, buttonText, type, resolve }
  const [alertDialog, setAlertDialog] = useState(null);

  // Toasts state: array of { id, message, type }
  const [toasts, setToasts] = useState([]);

  // Confirm method returning a Promise<boolean>
  const handleShowConfirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise((resolve) => {
      setConfirmDialog({
        isOpen: true,
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        type: opts.type || (opts.isDanger || opts.message?.toLowerCase().includes('delete') ? 'danger' : 'info'),
        resolve
      });
    });
  }, []);

  // Alert method returning a Promise<void>
  const handleShowAlert = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise((resolve) => {
      setAlertDialog({
        isOpen: true,
        title: opts.title || 'Notification',
        message: opts.message || '',
        buttonText: opts.buttonText || 'OK',
        type: opts.type || 'info',
        resolve
      });
    });
  }, []);

  // Toast method
  const handleShowToast = useCallback((message, type = 'info', duration = 3500) => {
    if (!message) return;
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  // Assign global singletons
  useEffect(() => {
    globalShowConfirm = handleShowConfirm;
    globalShowAlert = handleShowAlert;
    globalShowToast = handleShowToast;

    // Bridge window.confirm and window.alert globally to protect against unhandled alerts
    const originalAlert = window.alert;
    window.alert = (msg) => {
      handleShowToast(String(msg), 'info');
    };

    window.__platformToast = handleShowToast;
    window.__platformConfirm = handleShowConfirm;

    return () => {
      window.alert = originalAlert;
    };
  }, [handleShowConfirm, handleShowAlert, handleShowToast]);

  const closeConfirm = (result) => {
    if (confirmDialog?.resolve) {
      confirmDialog.resolve(result);
    }
    setConfirmDialog(null);
  };

  const closeAlert = () => {
    if (alertDialog?.resolve) {
      alertDialog.resolve();
    }
    setAlertDialog(null);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <DialogContext.Provider
      value={{
        showConfirm: handleShowConfirm,
        showAlert: handleShowAlert,
        showToast: handleShowToast,
        toast: {
          success: (msg, d) => handleShowToast(msg, 'success', d),
          error: (msg, d) => handleShowToast(msg, 'error', d),
          warning: (msg, d) => handleShowToast(msg, 'warning', d),
          info: (msg, d) => handleShowToast(msg, 'info', d),
        }
      }}
    >
      {children}

      {/* ── Toast Notifications Container ── */}
      <div className="fixed top-5 right-5 z-[10000] flex flex-col gap-2.5 pointer-events-none max-w-md w-full px-4 sm:px-0">
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const borderColor = isSuccess 
            ? 'border-emerald-200' 
            : isError 
            ? 'border-rose-200' 
            : isWarning 
            ? 'border-amber-200' 
            : 'border-blue-200';

          const textColor = isSuccess 
            ? 'text-emerald-950' 
            : isError 
            ? 'text-rose-950' 
            : isWarning 
            ? 'text-amber-950' 
            : 'text-blue-950';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border ${borderColor} flex items-start gap-3 transition-all animate-in slide-in-from-top-4 fade-in duration-200`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 size={18} className="text-emerald-600" />}
                {isError && <AlertCircle size={18} className="text-rose-600" />}
                {isWarning && <AlertTriangle size={18} className="text-amber-600" />}
                {!isSuccess && !isError && !isWarning && <Info size={18} className="text-blue-600" />}
              </div>
              <div className="flex-1 pr-2">
                <p className={`text-xs sm:text-sm font-semibold leading-relaxed ${textColor}`}>
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Confirmation Popup Modal ── */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150 relative"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                confirmDialog.type === 'danger'
                  ? 'bg-rose-50 text-rose-600 border-rose-100'
                  : confirmDialog.type === 'warning'
                  ? 'bg-amber-50 text-amber-600 border-amber-100'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
              }`}>
                {confirmDialog.type === 'danger' ? (
                  <Trash2 size={22} />
                ) : confirmDialog.type === 'warning' ? (
                  <AlertTriangle size={22} />
                ) : (
                  <HelpCircle size={22} />
                )}
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end items-center gap-2.5">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs transition cursor-pointer"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-5 py-2 rounded-xl text-white font-bold text-xs transition shadow-xs cursor-pointer ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert Popup Modal ── */}
      {alertDialog && alertDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl max-w-sm sm:max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150 relative text-center"
            role="dialog"
            aria-modal="true"
          >
            <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 border ${
              alertDialog.type === 'error'
                ? 'bg-rose-50 text-rose-600 border-rose-100'
                : alertDialog.type === 'success'
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : alertDialog.type === 'warning'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : 'bg-blue-50 text-blue-600 border-blue-100'
            }`}>
              {alertDialog.type === 'error' && <AlertCircle size={22} />}
              {alertDialog.type === 'success' && <CheckCircle2 size={22} />}
              {alertDialog.type === 'warning' && <AlertTriangle size={22} />}
              {(!alertDialog.type || alertDialog.type === 'info') && <Info size={22} />}
            </div>

            <h3 className="text-base font-bold text-gray-900 leading-tight">
              {alertDialog.title}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
              {alertDialog.message}
            </p>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={closeAlert}
                className="w-full sm:w-auto px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
              >
                {alertDialog.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    return {
      showConfirm,
      showAlert,
      showToast,
      toast
    };
  }
  return context;
}
