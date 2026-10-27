import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';
import { useSocketEvents } from '../../lib/socket';
import { showConfirm } from '../../context/DialogContext';

const API = import.meta.env.VITE_API_URL;

const SHIFT_TYPES = ['WORKING', 'HOLIDAY', 'LEAVE'];

const SHIFT_TYPE_STYLES = {
  WORKING: 'bg-green-50 text-green-700 border-green-200',
  HOLIDAY: 'bg-blue-50 text-blue-700 border-blue-200',
  LEAVE: 'bg-amber-50 text-amber-700 border-amber-200',
};

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeek = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (date.getDay() + 6) % 7; // Monday-first
  date.setDate(date.getDate() - diff);
  return date;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const fmtDay = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });
const fmtDate = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

const getHeaders = () => {
  const token = localStorage.getItem('token');
  const hostname = window.location.hostname;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
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

export default function StaffRoster() {
  const todayStr = toDateStr(new Date());

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [staff, setStaff] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showShiftForm, setShowShiftForm] = useState(false);
  const [shiftForm, setShiftForm] = useState({ name: '', startTime: '09:00', endTime: '18:00' });
  const [isSavingShift, setIsSavingShift] = useState(false);

  const flash = useCallback((message, isError = false) => {
    if (isError) {
      setError(message);
      setNotice('');
    } else {
      setNotice(message);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setNotice('');
    }, 3000);
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch(`${API}/restaurant/staff`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) {
        // Rosters are for staff only — exclude owner/admin accounts.
        setStaff((data.data.staff || []).filter((s) => s.role !== 'RESTAURANT_OWNER'));
      }
    } catch (err) {
      console.error(err);
      flash('Failed to load staff.', true);
    }
  }, [flash]);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/restaurant/shifts`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setShifts(data.data.shifts || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchRosters = useCallback(async () => {
    try {
      const from = toDateStr(weekStart);
      const to = toDateStr(addDays(weekStart, 6));
      const res = await fetch(`${API}/restaurant/rosters?from=${from}&to=${to}`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success) setRosters(data.data.rosters || []);
    } catch (err) {
      console.error(err);
      flash('Failed to load roster.', true);
    }
  }, [weekStart, flash]);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchStaff(), fetchShifts()]);
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchStaff, fetchShifts]);

  useEffect(() => {
    fetchRosters();
  }, [fetchRosters]);

  // Realtime: another admin changing shifts/rosters updates this view live.
  useSocketEvents({
    roster_updated: () => {
      fetchShifts();
      fetchRosters();
    },
    staff_updated: () => {
      fetchStaff();
      fetchRosters();
    },
  });

  const rosterMap = useMemo(() => {
    const map = new Map();
    rosters.forEach((r) => map.set(`${r.userId}|${r.date}`, r));
    return map;
  }, [rosters]);

  const weekCounts = useMemo(() => {
    const counts = {};
    rosters.forEach((r) => {
      if (r.shiftType === 'WORKING') counts[r.date] = (counts[r.date] || 0) + 1;
    });
    return counts;
  }, [rosters]);

  const upsertLocalRoster = (roster) => {
    setRosters((prev) => {
      const idx = prev.findIndex((r) => r.userId === roster.userId && r.date === roster.date);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = roster;
        return copy;
      }
      return [...prev, roster];
    });
  };

  const saveRoster = async (staffId, changes) => {
    const key = `${staffId}|${selectedDate}`;
    const existing = rosterMap.get(key);
    const shiftChanged = changes.shiftId !== undefined;
    const nextShiftId = shiftChanged ? changes.shiftId || null : existing?.shiftId || null;
    // Selecting a shift means the staff member is working that day. Status only
    // changes to Holiday/Leave when the owner explicitly selects it.
    const nextShiftType = changes.shiftType !== undefined
      ? changes.shiftType
      : shiftChanged && nextShiftId
        ? 'WORKING'
        : existing?.shiftType || 'WORKING';
    const payload = {
      userId: staffId,
      date: selectedDate,
      shiftId: nextShiftId,
      shiftType: nextShiftType,
    };
    setSavingKey(key);
    try {
      const res = await fetch(`${API}/restaurant/rosters`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        upsertLocalRoster(data.data.roster);
      } else {
        flash(data.message || 'Failed to save roster entry.', true);
      }
    } catch (err) {
      console.error(err);
      flash('Failed to save roster entry.', true);
    } finally {
      setSavingKey(null);
    }
  };

  const removeRosterEntry = async (staffId) => {
    const existing = rosterMap.get(`${staffId}|${selectedDate}`);
    if (!existing) return;
    setSavingKey(`${staffId}|${selectedDate}`);
    try {
      const res = await fetch(`${API}/restaurant/rosters/${existing._id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setRosters((prev) => prev.filter((r) => !(r.userId === staffId && r.date === selectedDate)));
      } else {
        flash(data.message || 'Failed to clear entry.', true);
      }
    } catch (err) {
      console.error(err);
      flash('Failed to clear entry.', true);
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.startTime || !shiftForm.endTime) return;
    setIsSavingShift(true);
    try {
      const res = await fetch(`${API}/restaurant/shifts`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(shiftForm),
      });
      const data = await res.json();
      if (data.success) {
        setShifts((prev) => [...prev, data.data.shift].sort((a, b) => a.startTime.localeCompare(b.startTime)));
        setShiftForm({ name: '', startTime: '09:00', endTime: '18:00' });
        flash('Shift added.');
      } else {
        flash(data.message || 'Failed to add shift.', true);
      }
    } catch (err) {
      console.error(err);
      flash('Failed to add shift.', true);
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (shift) => {
    const confirmed = await showConfirm({
      title: 'Delete Shift',
      message: `Are you sure you want to delete shift "${formatShift(shift)}"?`,
      confirmText: 'Delete Shift',
      confirmVariant: 'danger',
      icon: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`${API}/restaurant/shifts/${shift._id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setShifts((prev) => prev.filter((s) => s._id !== shift._id));
        setRosters((prev) => prev.map((r) => (r.shiftId === shift._id ? { ...r, shiftId: null } : r)));
        flash('Shift deleted.');
      } else {
        flash(data.message || 'Failed to delete shift.', true);
      }
    } catch (err) {
      console.error(err);
      flash('Failed to delete shift.', true);
    }
  };

  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="text-green-600" size={24} />
            Staff Roster
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Assign shifts and mark holidays or leave for your restaurant staff.
          </p>
        </div>
        <button
          onClick={() => setShowShiftForm((v) => !v)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors w-full sm:w-auto"
        >
          <Plus size={18} />
          Manage Shifts
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}

      {/* Shift manager */}
      {showShiftForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Clock size={18} className="text-green-600" />
              Shifts
            </h2>
            <button onClick={() => setShowShiftForm(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {shifts.length === 0 && (
              <p className="text-sm text-gray-400">No shifts yet. Create one below.</p>
            )}
            {shifts.map((s) => (
              <span
                key={s._id}
                className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-full"
              >
                {formatShift(s)}
                <button onClick={() => handleDeleteShift(s)} className="text-gray-400 hover:text-red-500" title="Delete shift">
                  <Trash2 size={14} />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleCreateShift} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Shift name (optional)"
              value={shiftForm.name}
              onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="time"
              value={shiftForm.startTime}
              onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="time"
              value={shiftForm.endTime}
              onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={isSavingShift}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors"
            >
              {isSavingShift ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Save Shift
            </button>
          </form>
        </div>
      )}

      {/* Week picker */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const prev = addDays(weekStart, -7);
              setWeekStart(prev);
              setSelectedDate(toDateStr(prev));
            }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2 sm:gap-3 text-center">
            <span className="text-xs sm:text-base font-semibold text-gray-800">
              {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}
            </span>
            <button
              onClick={() => {
                setWeekStart(startOfWeek(new Date()));
                setSelectedDate(todayStr);
              }}
              className="text-[10px] sm:text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full hover:bg-green-100"
            >
              Today
            </button>
          </div>
          <button
            onClick={() => {
              const next = addDays(weekStart, 7);
              setWeekStart(next);
              setSelectedDate(toDateStr(next));
            }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekDays.map((d) => {
            const ds = toDateStr(d);
            const isSelected = ds === selectedDate;
            const isToday = ds === todayStr;
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(ds)}
                className={`rounded-lg border px-1 sm:px-2 py-2 sm:py-3 text-center transition-colors ${
                  isSelected
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'
                }`}
              >
                <div className={`text-[10px] sm:text-xs font-semibold ${isSelected ? 'text-green-50' : 'text-gray-400'}`}>
                  {fmtDay(d)}
                </div>
                <div className="text-xs sm:text-sm font-bold">{d.getDate()}</div>
                <div className={`text-[9px] sm:text-[10px] mt-0.5 sm:mt-1 truncate ${isSelected ? 'text-green-50' : 'text-gray-400'}`}>
                  {weekCounts[ds] || 0} <span className="hidden sm:inline">working</span>
                </div>
                {isToday && (
                  <div className={`mx-auto mt-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-green-600'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Roster table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays size={18} className="text-green-600" />
            {selectedLabel}
          </h2>
          <span className="text-sm text-gray-500">{staff.length} staff</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={20} />
            Loading roster...
          </div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No staff members yet. Add staff from the Staff tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left py-3 px-5 font-semibold">Staff</th>
                  <th className="text-left py-3 px-5 font-semibold">Shift</th>
                  <th className="text-left py-3 px-5 font-semibold">Status</th>
                  <th className="text-right py-3 px-5 font-semibold">Clear</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => {
                  const key = `${member._id}|${selectedDate}`;
                  const entry = rosterMap.get(key);
                  const isSaving = savingKey === key;
                  return (
                    <tr key={member._id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-5">
                        <div className="font-medium text-gray-800">{member.name}</div>
                        <div className="text-xs text-gray-400">
                          {member.role === 'RESTAURANT_OWNER' ? 'Owner' : 'Staff'}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <select
                          value={entry?.shiftId || ''}
                          onChange={(e) => saveRoster(member._id, { shiftId: e.target.value })}
                          disabled={isSaving}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
                        >
                          <option value="">No shift</option>
                          {shifts.map((s) => (
                            <option key={s._id} value={s._id}>
                              {formatShift(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-5">
                        <select
                          value={entry?.shiftType || ''}
                          onChange={(e) => saveRoster(member._id, { shiftType: e.target.value })}
                          disabled={isSaving}
                          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 ${
                            entry?.shiftType
                              ? SHIFT_TYPE_STYLES[entry.shiftType]
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                          }`}
                        >
                          <option value="" disabled>Not set</option>
                          {SHIFT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.charAt(0) + t.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-5 text-right">
                        {isSaving ? (
                          <Loader2 className="animate-spin inline text-green-600" size={18} />
                        ) : (
                          <button
                            onClick={() => removeRosterEntry(member._id)}
                            disabled={!entry}
                            className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-400"
                            title="Clear entry"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatShift(shift) {
  if (!shift) return 'No shift';
  const range = `${shift.startTime} – ${shift.endTime}`;
  return shift.name ? `${shift.name} (${range})` : range;
}
