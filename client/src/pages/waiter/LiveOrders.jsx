import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Bell, CheckCircle, XCircle, Clock, AlertTriangle, UserCheck, ShieldCheck, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveOrders() {
  const [orders, setOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [waiter, setWaiter] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('ORDERS'); // 'ORDERS' | 'REQUESTS'
  const navigate = useNavigate();

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

  const fetchData = async () => {
    try {
      const [meRes, ordersRes, requestsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/auth/me`, { headers: getHeaders() }),
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders`, { headers: getHeaders() }),
        fetch(`${import.meta.env.VITE_API_URL}/restaurant/service-requests`, { headers: getHeaders() })
      ]);
      
      const meData = await meRes.json();
      if (meData.success && meData.data.user) {
        setWaiter(meData.data.user);
      }

      const ordersData = await ordersRes.json();
      if (ordersData.success) {
        const activeOrders = ordersData.data.orders.filter(o => 
          !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        );
        setOrders(activeOrders.map(o => ({ ...o, id: o._id })));
      }

      const reqData = await requestsRes.json();
      if (reqData.success && reqData.data.serviceRequests) {
        const openReqs = reqData.data.serviceRequests.filter(r => r.status !== 'RESOLVED' && r.status !== 'CANCELLED');
        setServiceRequests(openReqs);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchData();
    const pollInterval = setInterval(fetchData, 10000);

    const socketUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
    const socket = io(socketUrl, { withCredentials: true });

    socket.on('connect', () => {
      setConnected(true);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        socket.emit('waiter:join', { restaurantId: payload.restaurantId, waiterId: payload.id });
      } catch (err) {
        console.error("Failed to decode token", err);
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('assigned_order', (orderPayload) => {
      setOrders(prev => [{ ...orderPayload, id: orderPayload._id || orderPayload.id }, ...prev.filter(o => o.id !== (orderPayload._id || orderPayload.id))]);
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio error:', e));
      } catch(e){}
    });

    socket.on('new_order', (orderPayload) => {
      fetchData();
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => {
        if (['COMPLETED', 'CANCELLED', 'PAID'].includes(updatedOrder.status)) {
          return prev.filter(o => o.id !== updatedOrder._id && o._id !== updatedOrder._id);
        }
        const exists = prev.find(o => o.id === updatedOrder._id || o._id === updatedOrder._id);
        if (exists) {
          return prev.map(o => o.id === updatedOrder._id || o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o);
        } else {
          return [{ ...updatedOrder, id: updatedOrder._id }, ...prev];
        }
      });
    });

    socket.on('new_service_request', (reqPayload) => {
      setServiceRequests(prev => [reqPayload, ...prev.filter(r => r._id !== reqPayload._id)]);
    });

    socket.on('service_request_updated', (reqPayload) => {
      setServiceRequests(prev => {
        if (reqPayload.status === 'RESOLVED' || reqPayload.status === 'CANCELLED') {
          return prev.filter(r => r._id !== reqPayload._id);
        }
        return prev.map(r => r._id === reqPayload._id ? reqPayload : r);
      });
    });

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
  }, [navigate]);

  const toggleShift = async () => {
    if (!waiter) return;
    const newShift = waiter.shiftStatus === 'ON_SHIFT' ? 'OFF_SHIFT' : 'ON_SHIFT';
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/waiters/my-availability`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ shiftStatus: newShift })
      });
      const data = await res.json();
      if (data.success) {
        setWaiter(prev => ({ ...prev, shiftStatus: newShift }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateAvailability = async (status) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/waiters/my-availability`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ availabilityStatus: status })
      });
      const data = await res.json();
      if (data.success) {
        setWaiter(prev => ({ ...prev, availabilityStatus: status }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/accept`, {
        method: 'PATCH',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId) ? { ...o, assignmentStatus: 'ACCEPTED', status: 'READ' } : o));
      } else {
        alert(data.message || 'Failed to accept order');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRejectOrder = async (orderId) => {
    const reason = window.prompt('Reason for rejecting this order (e.g. Overloaded, break)?', 'Busy with table');
    if (!reason) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/reject`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.filter(o => o.id !== orderId && o._id !== orderId));
      } else {
        alert(data.message || 'Failed to reject order');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        if (['COMPLETED', 'CANCELLED', 'PAID'].includes(status)) {
          setOrders(prev => prev.filter(o => o.id !== orderId && o._id !== orderId));
        } else {
          setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId) ? { ...o, status } : o));
        }
      }
    } catch (err) {
      console.error(err);
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
        if (status === 'RESOLVED') {
          setServiceRequests(prev => prev.filter(r => r._id !== requestId));
        } else {
          setServiceRequests(prev => prev.map(r => r._id === requestId ? { ...r, status } : r));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter orders assigned directly to this waiter or to this waiter's assigned tables
  const myAssignedTableIds = (waiter?.assignedTables || []).map(t => (typeof t === 'string' ? t : t._id));
  const myOrders = orders.filter(o => {
    const isDirectlyAssigned = o.assignedWaiterId && (o.assignedWaiterId._id || o.assignedWaiterId) === waiter?._id;
    const isTableAssigned = myAssignedTableIds.includes(o.tableId);
    return isDirectlyAssigned || isTableAssigned || myAssignedTableIds.length === 0;
  });

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Top Presence & Shift Control Bar */}
      {waiter && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${waiter.shiftStatus === 'ON_SHIFT' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <div>
              <p className="font-bold text-gray-800 text-sm">{waiter.name} · {waiter.shiftStatus === 'ON_SHIFT' ? 'On Duty' : 'Off Duty'}</p>
              <p className="text-xs text-gray-500">
                Workload: {myOrders.length} active orders · Capacity: {waiter.workloadCapacity || 5} · Status: <span className="font-semibold text-green-700">{waiter.availabilityStatus}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleShift}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                waiter.shiftStatus === 'ON_SHIFT'
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {waiter.shiftStatus === 'ON_SHIFT' ? 'End Shift' : 'Start Shift'}
            </button>

            {waiter.shiftStatus === 'ON_SHIFT' && (
              <div className="flex bg-gray-100 p-1 rounded-lg gap-1 text-xs font-semibold">
                {['AVAILABLE', 'BUSY', 'PAUSED'].map(st => (
                  <button
                    key={st}
                    onClick={() => updateAvailability(st)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      waiter.availabilityStatus === st ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Assigned Orders & Requests</h1>
          <p className="text-gray-500 text-sm">Real-time table orders and customer assistance requests</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-200 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'ORDERS' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              <Bell size={15} /> Active Orders ({myOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('REQUESTS')}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'REQUESTS' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'
              }`}
            >
              <HelpCircle size={15} /> Table Requests ({serviceRequests.length})
            </button>
          </div>

          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${connected ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Active Orders List */}
      {activeTab === 'ORDERS' && (
        <div className="flex-1 overflow-y-auto">
          {myOrders.length === 0 ? (
            <div className="text-center py-20 text-gray-400 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
              <Bell size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-semibold text-gray-600">No active orders assigned to you right now.</p>
              <p className="text-xs text-gray-400 mt-1">New orders routed by the assignment engine will appear here immediately.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {myOrders.map((order, idx) => {
                const isPendingAcceptance = order.assignmentStatus === 'PENDING_ACCEPTANCE';
                const isOverflow = order.assignmentType === 'OVERFLOW';

                return (
                  <div key={order.id || idx} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 flex flex-col justify-between ${
                    isPendingAcceptance ? 'border-amber-500 bg-amber-50/20' : 'border-green-600'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-gray-900">Table {order.tableNumber || order.table}</h3>
                            {isOverflow && (
                              <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                OVERFLOW
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{order.orderNumber || order.id?.substring(0,8)}</p>
                        </div>
                        <div className="text-right">
                          <span className={`font-bold px-2.5 py-1 rounded-md text-xs ${
                            isPendingAcceptance
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {isPendingAcceptance ? 'NEEDS ACCEPTANCE' : order.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto pr-2">
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm text-gray-700">
                            <span className="font-medium">{item.quantity || item.qty}x {item.itemName || item.name}</span>
                            <span className="text-gray-400 text-xs">₹{((item.subtotal || item.price * item.quantity) || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-xs text-gray-400 mb-4 flex justify-between">
                        <span>Total: <strong className="text-gray-800 text-sm">₹{order.total || 0}</strong></span>
                        <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                      {isPendingAcceptance ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptOrder(order.id || order._id)}
                            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle size={16} /> Accept Order
                          </button>
                          <button
                            onClick={() => handleRejectOrder(order.id || order._id)}
                            className="py-2.5 px-3 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                          >
                            <XCircle size={16} /> Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {order.status === 'PENDING' && (
                            <button 
                              onClick={() => updateOrderStatus(order.id || order._id, 'READ')}
                              className="flex-1 py-2 border border-green-600 text-green-700 hover:bg-green-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                            >
                              <CheckCircle size={15} /> Mark Read
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              if (window.confirm(`Mark Table ${order.tableNumber || order.table}'s order as completed? This will free the table for new customers.`)) {
                                updateOrderStatus(order.id || order._id, 'COMPLETED');
                              }
                            }}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle size={15} /> Completed (Free Table)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Customer Service Requests List */}
      {activeTab === 'REQUESTS' && (
        <div className="flex-1 overflow-y-auto">
          {serviceRequests.length === 0 ? (
            <div className="text-center py-20 text-gray-400 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
              <HelpCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-semibold text-gray-600">No open customer service requests.</p>
              <p className="text-xs text-gray-400 mt-1">When customers request water, cutlery, or bills, they appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {serviceRequests.map(req => (
                <div key={req._id} className="bg-white rounded-2xl shadow-sm p-5 border-l-4 border-blue-500 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">Table {req.tableNumber}</h3>
                        <p className="text-xs text-blue-600 font-semibold">{req.type.replace('_', ' ')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        req.status === 'OPEN' ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    {req.note && (
                      <p className="text-sm text-gray-600 italic bg-gray-50 p-2.5 rounded-lg mb-3">
                        "{req.note}"
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mb-4">
                      Requested {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    {req.status === 'OPEN' && (
                      <button
                        onClick={() => handleResolveRequest(req._id, 'ACKNOWLEDGED')}
                        className="flex-1 py-2 border border-blue-600 text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleResolveRequest(req._id, 'RESOLVED')}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      Resolve Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
