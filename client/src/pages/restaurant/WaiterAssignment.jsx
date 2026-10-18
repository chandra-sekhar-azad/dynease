import React, { useState, useEffect } from 'react';
import { 
  Users, Settings as SettingsIcon, Clock, CheckCircle2, 
  AlertCircle, ArrowRightLeft, UserCheck, ShieldAlert,
  Save, RefreshCw, BarChart3, History, HelpCircle
} from 'lucide-react';

export default function WaiterAssignment() {
  const [activeTab, setActiveTab] = useState('TABLES'); // 'TABLES' | 'WORKLOAD' | 'SETTINGS' | 'HISTORY' | 'REQUESTS'
  const [tables, setTables] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [settings, setSettings] = useState({
    mode: 'HYBRID',
    defaultCapacity: 5,
    weightWorkload: 0.60,
    weightRecentAssignment: 0.25,
    weightSectionMismatch: 0.15,
    allowOverflow: true,
    acceptanceTimeoutMinutes: 3,
    reassignmentPolicy: 'AUTO_REASSIGN'
  });
  const [history, setHistory] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reassignModal, setReassignModal] = useState({ open: false, table: null, targetWaiterId: '' });

  const getHeaders = (includeContentType = true) => {
    const token = localStorage.getItem('token');
    const hostname = window.location.hostname;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (includeContentType) headers['Content-Type'] = 'application/json';
    let subdomain = '';
    if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in') {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('localhost') && hostname !== 'localhost') {
      subdomain = hostname.split('.')[0];
    }
    if (subdomain) headers['x-tenant-subdomain'] = subdomain;
    return headers;
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [tablesRes, waitersRes, settingsRes, historyRes, reqRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables`, { headers: getHeaders(false) }),
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/waiters/workload`, { headers: getHeaders(false) }),
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/assignment/settings`, { headers: getHeaders(false) }),
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/assignment/history`, { headers: getHeaders(false) }),
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/service-requests`, { headers: getHeaders(false) })
      ]);

      const [tablesData, waitersData, settingsData, historyData, reqData] = await Promise.all([
        tablesRes.json(), waitersRes.json(), settingsRes.json(), historyRes.json(), reqRes.json()
      ]);

      if (tablesData.success) setTables(tablesData.data.tables);
      if (waitersData.success) setWaiters(waitersData.data.waiters);
      if (settingsData.success) setSettings(settingsData.data.settings);
      if (historyData.success) setHistory(historyData.data.events);
      if (reqData.success) setServiceRequests(reqData.data.serviceRequests);
    } catch (err) {
      console.error('Error fetching assignment data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignTable = async (tableId, waiterId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables/${tableId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ primaryWaiterId: waiterId || null })
      });
      const data = await res.json();
      if (data.success) {
        setTables(prev => prev.map(t => t._id === tableId ? data.data.table : t));
        fetchAllData(); // Refresh history & workload
      } else {
        alert(data.message || 'Failed to assign table');
      }
    } catch (e) {
      console.error(e);
      alert('Error assigning table');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/assignment/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        alert('Assignment settings saved successfully!');
      } else {
        alert(data.message || 'Failed to save settings');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResolveRequest = async (requestId, status = 'RESOLVED') => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/service-requests/${requestId}/resolve`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setServiceRequests(prev => prev.filter(r => r._id !== requestId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">Waiter-to-Table Assignment</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              settings.mode === 'HYBRID' ? 'bg-purple-100 text-purple-700' :
              settings.mode === 'AUTOMATIC' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              Mode: {settings.mode}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Manage table ownership, workload-aware auto routing, presence controls, and audit trails
          </p>
        </div>

        <button 
          onClick={fetchAllData}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-2xl px-6 pt-2 gap-4">
        {[
          { id: 'TABLES', label: `Table Assignments (${tables.length})`, icon: ArrowRightLeft },
          { id: 'WORKLOAD', label: `Waiter Workload (${waiters.length})`, icon: BarChart3 },
          { id: 'REQUESTS', label: `Service Requests (${serviceRequests.length})`, icon: HelpCircle },
          { id: 'SETTINGS', label: 'Engine Settings', icon: SettingsIcon },
          { id: 'HISTORY', label: 'Audit Trail', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3.5 px-3 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Table-Level Primary Waiter Assignments */}
      {activeTab === 'TABLES' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-sm border border-gray-100 border-t-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map(table => {
              const primaryWaiter = table.primaryWaiterId;
              const isAssigned = !!primaryWaiter;

              return (
                <div key={table._id} className="border border-gray-200 hover:border-green-300 rounded-2xl p-5 shadow-sm transition-all bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-extrabold text-xl text-gray-900">Table {table.tableNumber}</h3>
                        <p className="text-xs text-gray-500 font-medium">{table.tableName || 'Main Area'} · {table.section || 'Main Area'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        table.isOccupied ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {table.isOccupied ? '• Occupied' : '• Free'}
                      </span>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl mb-4 border border-gray-100">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                        Primary Assigned Waiter
                      </span>
                      {isAssigned ? (
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                            <UserCheck size={16} className="text-green-600" />
                            {primaryWaiter.name}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            primaryWaiter.shiftStatus === 'ON_SHIFT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {primaryWaiter.shiftStatus === 'ON_SHIFT' ? 'On Duty' : 'Off Duty'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400 italic">
                          No waiter assigned (Unassigned)
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                      Assign / Change Primary Waiter:
                    </label>
                    <select
                      value={primaryWaiter?._id || ''}
                      onChange={(e) => handleAssignTable(table._id, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="">-- No Waiter Assigned --</option>
                      {waiters.map(w => (
                        <option key={w._id} value={w._id}>
                          {w.name} ({w.shiftStatus === 'ON_SHIFT' ? 'On Duty' : 'Off Duty'} · {w.totalWorkload}/{w.workloadCapacity} orders)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Waiter Presence & Live Workload */}
      {activeTab === 'WORKLOAD' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-sm border border-gray-100 border-t-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Waiter Name</th>
                  <th className="py-3 px-4">Shift Status</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4">Active Orders</th>
                  <th className="py-3 px-4">Service Requests</th>
                  <th className="py-3 px-4">Load Ratio / Capacity</th>
                  <th className="py-3 px-4">Assigned Tables</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {waiters.map(w => {
                  const capacity = w.workloadCapacity || 5;
                  const ratio = Math.min(Math.round((w.totalWorkload / capacity) * 100), 100);

                  return (
                    <tr key={w._id} className="hover:bg-gray-50/50">
                      <td className="py-4 px-4 font-bold text-gray-900">
                        {w.name}
                        <span className="block text-xs font-normal text-gray-400">{w.email}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          w.shiftStatus === 'ON_SHIFT' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {w.shiftStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          w.availabilityStatus === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' :
                          w.availabilityStatus === 'BUSY' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {w.availabilityStatus}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-gray-800">
                        {w.activeOrdersCount}
                      </td>
                      <td className="py-4 px-4 font-bold text-gray-800">
                        {w.activeRequestsCount}
                      </td>
                      <td className="py-4 px-4">
                        <div className="w-36">
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span>{w.totalWorkload} / {capacity}</span>
                            <span className="text-gray-400">{ratio}%</span>
                          </div>
                          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${ratio >= 100 ? 'bg-red-500' : ratio >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} 
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-gray-600">
                        {w.assignedTables?.length > 0 
                          ? w.assignedTables.map(t => `T-${t.tableNumber}`).join(', ')
                          : <span className="text-gray-400 italic">None</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Customer Service Requests */}
      {activeTab === 'REQUESTS' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-sm border border-gray-100 border-t-0">
          {serviceRequests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle2 size={48} className="mx-auto mb-3 opacity-40 text-green-500" />
              <p className="font-semibold text-gray-700">All customer assistance requests are resolved!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {serviceRequests.map(req => (
                <div key={req._id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg text-gray-900">Table {req.tableNumber}</h4>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                        req.status === 'OPEN' ? 'bg-blue-100 text-blue-800 animate-pulse' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-blue-600 mb-2">
                      {req.type.replace('_', ' ')}
                    </p>

                    {req.note && (
                      <p className="text-xs text-gray-600 italic bg-gray-50 p-2.5 rounded-lg mb-3">
                        "{req.note}"
                      </p>
                    )}

                    <p className="text-[11px] text-gray-400 mb-4">
                      Assigned Waiter: <strong className="text-gray-700">{req.assignedWaiterId?.name || 'Unassigned'}</strong>
                    </p>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleResolveRequest(req._id, 'RESOLVED')}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Engine Settings */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-b-2xl p-8 shadow-sm border border-gray-100 border-t-0 max-w-3xl space-y-6">
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800">Assignment Mode</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'HYBRID', title: 'Hybrid (Recommended)', desc: 'Keeps primary table waiter; routes to overflow when overloaded or absent.' },
                { id: 'AUTOMATIC', title: 'Pure Automatic', desc: 'Recalculates best available waiter dynamically for every new order.' },
                { id: 'MANUAL', title: 'Manual Only', desc: 'Strictly routes orders only to manager-assigned table waiters.' },
              ].map(modeOpt => (
                <div
                  key={modeOpt.id}
                  onClick={() => setSettings({ ...settings, mode: modeOpt.id })}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    settings.mode === modeOpt.id
                      ? 'border-green-600 bg-green-50/30'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-bold text-gray-900 text-sm mb-1">{modeOpt.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{modeOpt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">
                Default Workload Capacity (Orders per Waiter)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings.defaultCapacity || 5}
                onChange={e => setSettings({ ...settings, defaultCapacity: parseInt(e.target.value) || 5 })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Maximum active orders a waiter handles before overflow kicks in.</p>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">
                Acceptance Timeout (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="15"
                value={settings.acceptanceTimeoutMinutes || 3}
                onChange={e => setSettings({ ...settings, acceptanceTimeoutMinutes: parseInt(e.target.value) || 3 })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-400 mt-1">Time before an unaccepted order auto-reassigns or alerts managers.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h4 className="font-bold text-sm text-gray-800">Scoring Model Weights (Normalized Sum: 1.0)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Workload (60%)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.weightWorkload}
                  onChange={e => setSettings({ ...settings, weightWorkload: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Recent Penalty (25%)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.weightRecentAssignment}
                  onChange={e => setSettings({ ...settings, weightRecentAssignment: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Section Match (15%)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={settings.weightSectionMismatch}
                  onChange={e => setSettings({ ...settings, weightSectionMismatch: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors"
            >
              <Save size={16} />
              {savingSettings ? 'Saving...' : 'Save Engine Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 5: Audit Trail History */}
      {activeTab === 'HISTORY' && (
        <div className="bg-white rounded-b-2xl p-6 shadow-sm border border-gray-100 border-t-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Reason / Score</th>
                  <th className="py-3 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {history.map(ev => (
                  <tr key={ev._id} className="hover:bg-gray-50/50">
                    <td className="py-3.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-700 text-xs">
                      {ev.targetType}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      Table {ev.tableNumber || '-'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        ev.action === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                        ev.action === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        ev.action === 'OVERFLOW_ASSIGNED' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {ev.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800">
                      {ev.newWaiterId?.name || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600 max-w-xs truncate" title={ev.reason}>
                      {ev.reason} {ev.score !== null ? `(Score: ${ev.score})` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-400">
                      {ev.actorRole}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
