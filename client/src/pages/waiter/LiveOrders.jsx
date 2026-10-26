import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  HelpCircle,
  Sparkles,
  PlusCircle,
  Edit3,
  Trash2,
  Plus,
  Minus,
  User,
  FileText,
  X,
  Search,
  Check,
  QrCode
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveOrders() {
  const [orders, setOrders] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [waiter, setWaiter] = useState(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('ORDERS'); // 'ORDERS' | 'REQUESTS'
  const [moreItemsAlert, setMoreItemsAlert] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stagedItems, setStagedItems] = useState([]);
  const [addSuccessMsg, setAddSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        const mappedOrders = activeOrders.map(o => ({ ...o, id: o._id || o.id }));
        setOrders(mappedOrders);

        // Keep editingOrder synchronized if modal is currently open
        setEditingOrder(prev => {
          if (!prev) return null;
          const fresh = mappedOrders.find(o => 
            o.id === prev.id || 
            o._id === prev.id || 
            o.id === prev._id || 
            (prev.visitId && (o.id === prev.visitId || o.visitId === prev.visitId)) ||
            (prev.visit_id && (o.id === prev.visit_id || o.visit_id === prev.visit_id))
          );
          if (!fresh) return prev;
          return {
            ...prev,
            ...fresh,
            items: fresh.items && fresh.items.length > 0 ? fresh.items : prev.items
          };
        });
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

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/menu`, { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.data?.menuItems) {
        setMenuItems(data.data.menuItems.filter(m => m.menuItemStatus !== 'UNAVAILABLE'));
      }
    } catch (e) {
      console.error('Error fetching menu:', e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchData();
    fetchMenu();
    const pollInterval = setInterval(fetchData, 3000);

    const socketUrl = import.meta.env.VITE_API_URL.replace(/\/api$/, '');
    const socket = io(socketUrl, { withCredentials: true, auth: { token } });

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
      setOrders(prev => [{ ...orderPayload, id: orderPayload._id || orderPayload.id }, ...prev.filter(o => (o.id || o._id) !== (orderPayload._id || orderPayload.id))]);
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio error:', e));
      } catch(e){}
    });

    socket.on('new_order', () => {
      fetchData();
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio error:', e));
      } catch(e){}
    });

    socket.on('more_items_added', (orderPayload) => {
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(e => console.log('Audio error:', e));
      } catch(e){}

      const targetId = orderPayload._id || orderPayload.id;
      setMoreItemsAlert({
        id: targetId,
        tableNumber: orderPayload.tableNumber || orderPayload.table,
        orderNumber: orderPayload.orderNumber || targetId?.substring(0, 8),
        newItems: orderPayload.newItems || [],
        addedCount: orderPayload.addedCount || 1,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      setOrders(prev => {
        const targetVisitId = orderPayload.visitId || orderPayload.visit_id;
        const exists = prev.find(o => 
          o.id === targetId || 
          o._id === targetId ||
          (targetVisitId && (o.id === targetVisitId || o.visitId === targetVisitId)) ||
          (o.visitId && o.visitId === targetId)
        );
        if (exists) {
          return prev.map(o => {
            const isMatch = 
              o.id === targetId || 
              o._id === targetId || 
              (targetVisitId && (o.id === targetVisitId || o.visitId === targetVisitId)) ||
              (o.visitId && o.visitId === targetId);
            if (!isMatch) return o;
            return {
              ...o,
              ...orderPayload,
              hasNewItems: true,
              appStatus: o.appStatus === 'ACCEPTED' ? 'ACCEPTED' : (orderPayload.appStatus || o.appStatus),
              assignmentStatus: o.assignmentStatus === 'ACCEPTED' ? 'ACCEPTED' : (orderPayload.assignmentStatus || o.assignmentStatus),
              status: ['ACCEPTED', 'PREPARING', 'READY', 'SERVED'].includes(o.status) ? o.status : (orderPayload.status || o.status)
            };
          });
        } else {
          fetchData();
          return prev;
        }
      });
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => {
        const uId = updatedOrder._id || updatedOrder.id;
        const uVisitId = updatedOrder.visitId || updatedOrder.visit_id;
        if (['COMPLETED', 'CANCELLED', 'PAID'].includes(updatedOrder.status)) {
          return prev.filter(o => 
            o.id !== uId && 
            o._id !== uId && 
            (!uVisitId || (o.id !== uVisitId && o.visitId !== uVisitId))
          );
        }
        const exists = prev.find(o => 
          o.id === uId || 
          o._id === uId || 
          (uVisitId && (o.id === uVisitId || o.visitId === uVisitId)) ||
          (o.visitId && o.visitId === uId)
        );
        if (exists) {
          return prev.map(o => {
            const isMatch = 
              o.id === uId || 
              o._id === uId || 
              (uVisitId && (o.id === uVisitId || o.visitId === uVisitId)) ||
              (o.visitId && o.visitId === uId);
            if (!isMatch) return o;
            return {
              ...o,
              ...updatedOrder,
              items: (updatedOrder.items && updatedOrder.items.length > 0) ? updatedOrder.items : o.items,
              tableNumber: updatedOrder.tableNumber || o.tableNumber,
              table: updatedOrder.table || o.table,
              appStatus: updatedOrder.appStatus || o.appStatus,
              assignmentStatus: updatedOrder.assignmentStatus || o.assignmentStatus,
              status: updatedOrder.status || o.status
            };
          });
        } else {
          fetchData();
          return prev;
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
      // Optimistically mark as accepted immediately in local state
      setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId || o.visitId === orderId) ? {
        ...o,
        assignmentStatus: 'ACCEPTED',
        status: 'ACCEPTED',
        appStatus: 'ACCEPTED'
      } : o));

      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/accept`, {
        method: 'PATCH',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const acceptedId = data.data?.order?.id || data.data?.order?._id || orderId;
        const acceptedVisitId = data.data?.order?.visitId;
        setOrders(prev => prev.map(o => 
          (o.id === orderId || o._id === orderId || o.id === acceptedId || o._id === acceptedId || (acceptedVisitId && (o.id === acceptedVisitId || o.visitId === acceptedVisitId))) ? {
            ...o,
            assignmentStatus: 'ACCEPTED',
            status: 'ACCEPTED',
            appStatus: 'ACCEPTED'
          } : o
        ));
        fetchData();
      } else {
        alert(data.message || 'Failed to accept order');
        fetchData();
      }
    } catch (e) {
      console.error(e);
      alert('Network error accepting order');
      fetchData();
    }
  };

  const handleRejectOrder = async (orderId) => {
    const reason = window.prompt('Reason for rejecting this order (e.g. Items out of stock, kitchen busy)?', 'Items unavailable');
    if (reason === null) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/reject`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ reason: reason || 'Waiter rejected' })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.filter(o => o.id !== orderId && o._id !== orderId));
        if (editingOrder && (editingOrder.id === orderId || editingOrder._id === orderId)) {
          setEditingOrder(null);
        }
      } else {
        alert(data.message || 'Failed to reject order');
      }
    } catch (e) {
      console.error(e);
      alert('Network error rejecting order');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      if (['COMPLETED', 'CANCELLED', 'PAID'].includes(status)) {
        setOrders(prev => prev.filter(o => o.id !== orderId && o._id !== orderId && o.visitId !== orderId));
        if (editingOrder && (editingOrder.id === orderId || editingOrder._id === orderId || editingOrder.visitId === orderId)) {
          setEditingOrder(null);
        }
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        if (['COMPLETED', 'CANCELLED', 'PAID'].includes(status)) {
          setOrders(prev => prev.filter(o => o.id !== orderId && o._id !== orderId && o.visitId !== orderId));
        } else {
          setOrders(prev => prev.map(o => (o.id === orderId || o._id === orderId || o.visitId === orderId) ? { ...o, status } : o));
        }
        fetchData();
      } else {
        alert(data.message || 'Could not update status');
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleCancelOccupation = async (order) => {
    const tableNum = order.tableNumber || order.table || 'this table';
    if (!window.confirm(`Cancel occupation for Table ${tableNum}? This will free the table so another customer can scan and occupy.`)) {
      return;
    }

    try {
      const orderId = order.id || order._id;
      setOrders(prev => prev.filter(o => o.id !== orderId && o._id !== orderId && o.visitId !== orderId));
      if (editingOrder && (editingOrder.id === orderId || editingOrder._id === orderId || editingOrder.visitId === orderId)) {
        setEditingOrder(null);
      }

      const tableId = order.tableId?._id || order.tableId?.id || order.tableId;
      let res;
      if (tableId) {
        res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/tables/${tableId}/cancel-allocation`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ visitId: orderId, reason: 'Waiter cancelled occupation' })
        });
      } else {
        res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status: 'CANCELLED' })
        });
      }

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message || 'Could not cancel table occupation');
        fetchData();
      }
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleDeleteOrderItem = async (orderId, itemId, itemName) => {
    if (!window.confirm(`Delete "${itemName || 'this item'}" from the order?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/items/${itemId}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => {
          if (o.id === orderId || o._id === orderId) {
            const updatedItems = (o.items || []).filter(i => (i.id || i._id) !== itemId);
            const newTotal = updatedItems.reduce((sum, i) => sum + (Number(i.subtotal ?? i.total ?? ((i.unitPrice || i.price || 0) * (i.quantity || 1))) || 0), 0);
            return { ...o, items: updatedItems, total: newTotal, subtotal: newTotal };
          }
          return o;
        }));

        if (editingOrder && (editingOrder.id === orderId || editingOrder._id === orderId)) {
          setEditingOrder(prev => {
            const updatedItems = (prev.items || []).filter(i => (i.id || i._id) !== itemId);
            const newTotal = updatedItems.reduce((sum, i) => sum + (Number(i.subtotal ?? i.total ?? ((i.unitPrice || i.price || 0) * (i.quantity || 1))) || 0), 0);
            return { ...prev, items: updatedItems, total: newTotal, subtotal: newTotal };
          });
        }
      } else {
        alert(data.message || 'Failed to delete item.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error deleting item');
    }
  };

  const handleUpdateItemQuantity = async (orderId, itemId, newQuantity) => {
    if (newQuantity <= 0) {
      const item = editingOrder?.items?.find(i => (i.id || i._id) === itemId);
      return handleDeleteOrderItem(orderId, itemId, item?.itemName || item?.name);
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/items/${itemId}/quantity`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ acceptedQuantity: newQuantity })
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => {
          if (o.id === orderId || o._id === orderId) {
            const updatedItems = (o.items || []).map(i => {
              if ((i.id || i._id) === itemId) {
                const unitPrice = Number(i.unitPrice || i.price || 0);
                return { ...i, quantity: newQuantity, total: unitPrice * newQuantity, subtotal: unitPrice * newQuantity };
              }
              return i;
            });
            const newTotal = updatedItems.reduce((sum, i) => sum + (Number(i.subtotal ?? i.total ?? ((i.unitPrice || i.price || 0) * (i.quantity || 1))) || 0), 0);
            return { ...o, items: updatedItems, total: newTotal, subtotal: newTotal };
          }
          return o;
        }));

        if (editingOrder && (editingOrder.id === orderId || editingOrder._id === orderId)) {
          setEditingOrder(prev => {
            const updatedItems = (prev.items || []).map(i => {
              if ((i.id || i._id) === itemId) {
                const unitPrice = Number(i.unitPrice || i.price || 0);
                return { ...i, quantity: newQuantity, total: unitPrice * newQuantity, subtotal: unitPrice * newQuantity };
              }
              return i;
            });
            const newTotal = updatedItems.reduce((sum, i) => sum + (Number(i.subtotal ?? i.total ?? ((i.unitPrice || i.price || 0) * (i.quantity || 1))) || 0), 0);
            return { ...prev, items: updatedItems, total: newTotal, subtotal: newTotal };
          });
        }
      } else {
        alert(data.message || 'Failed to update quantity.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error updating item quantity');
    }
  };

  // Stage an item to be added in the multi-item batch
  const handleStageItem = (menuItem, sizeOverride = null, quantityToAdd = 1) => {
    const mId = menuItem.id || menuItem._id;
    let size = sizeOverride !== null ? sizeOverride : (menuItem.quantities && menuItem.quantities.length > 0 ? menuItem.quantities[0]?.size : '');
    let price = parseFloat(menuItem.price || 0);

    if (size && menuItem.quantities && menuItem.quantities.length > 0) {
      const match = menuItem.quantities.find(q => q.size?.toLowerCase() === size.toLowerCase());
      if (match && !isNaN(parseFloat(match.price))) {
        price = parseFloat(match.price);
      }
    }

    const stageKey = `${mId}_${size || 'default'}`;

    setStagedItems(prev => {
      const existingIdx = prev.findIndex(item => item.stageKey === stageKey);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantityToAdd;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          total: price * newQty
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            stageKey,
            menuItemId: mId,
            name: menuItem.name,
            category: menuItem.category,
            size: size || '',
            unitPrice: price,
            quantity: quantityToAdd,
            total: price * quantityToAdd
          }
        ];
      }
    });
  };

  const handleUpdateStagedItemQty = (stageKey, delta) => {
    setStagedItems(prev => {
      return prev
        .map(item => {
          if (item.stageKey === stageKey) {
            const newQty = item.quantity + delta;
            return {
              ...item,
              quantity: newQty,
              total: item.unitPrice * newQty
            };
          }
          return item;
        })
        .filter(item => item.quantity > 0);
    });
  };

  const handleRemoveStagedItem = (stageKey) => {
    setStagedItems(prev => prev.filter(item => item.stageKey !== stageKey));
  };

  const handleAddStagedItemsToOrder = async (orderId) => {
    if (stagedItems.length === 0) return;
    setIsSubmitting(true);
    setAddSuccessMsg('');

    try {
      const payloadItems = stagedItems.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        size: item.size || ''
      }));

      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/orders/${orderId}/items`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ items: payloadItems })
      });

      const data = await res.json();
      if (data.success) {
        // Map created items safely from backend response
        const newlyAdded = (data.data?.items || []).map(oi => ({
          id: oi.id || oi._id,
          _id: oi.id || oi._id,
          itemName: oi.item_name || oi.itemName || oi.name,
          name: oi.item_name || oi.itemName || oi.name,
          unitPrice: Number(oi.unit_price || oi.unitPrice || oi.price || 0),
          price: Number(oi.unit_price || oi.unitPrice || oi.price || 0),
          quantity: parseInt(oi.quantity, 10) || 1,
          subtotal: Number(oi.total || oi.subtotal || 0),
          total: Number(oi.total || oi.total || 0),
          size: oi.customizations || oi.size || null,
          status: oi.item_status || oi.status || 'PENDING',
          menuItemId: oi.menu_item_id || oi.menuItemId
        }));

        // Fallback: if data.data?.items is empty for any reason, use staged items
        const itemsToAppend = newlyAdded.length > 0 ? newlyAdded : stagedItems.map((si, idx) => ({
          id: `added-${Date.now()}-${idx}`,
          itemName: si.name,
          name: si.name,
          unitPrice: si.unitPrice,
          price: si.unitPrice,
          quantity: si.quantity,
          subtotal: si.total,
          total: si.total,
          size: si.size || null,
          status: 'PENDING'
        }));

        // Immediately update editingOrder items list in the modal so they show instantly!
        setEditingOrder(prev => {
          if (!prev) return prev;
          const merged = [...(prev.items || []), ...itemsToAppend];
          const newTotal = merged.reduce((sum, i) => sum + (Number(i.subtotal ?? i.total ?? ((i.unitPrice || 0) * (i.quantity || 1))) || 0), 0);
          return {
            ...prev,
            items: merged,
            total: newTotal,
            subtotal: newTotal
          };
        });

        // Immediately update dashboard card
        setOrders(prev => prev.map(o => {
          if (o.id === orderId || o._id === orderId || (o.visit_id && o.visit_id === orderId) || (o.visitId && o.visitId === orderId)) {
            const merged = [...(o.items || []), ...itemsToAppend];
            const newTotal = merged.reduce((sum, i) => sum + (Number(i.subtotal ?? i.total ?? ((i.unitPrice || 0) * (i.quantity || 1))) || 0), 0);
            return {
              ...o,
              items: merged,
              total: newTotal,
              subtotal: newTotal
            };
          }
          return o;
        }));

        const totalItemsCount = stagedItems.reduce((sum, i) => sum + i.quantity, 0);
        setAddSuccessMsg(`✓ Added ${totalItemsCount} item${totalItemsCount > 1 ? 's' : ''} to order!`);
        setTimeout(() => setAddSuccessMsg(''), 4000);

        setStagedItems([]);

        // Sync with backend in background
        fetchData();
      } else {
        alert(data.message || 'Failed to add items to order.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error adding items to order');
    } finally {
      setIsSubmitting(false);
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
  const myAssignedTableIds = (waiter?.assignedTables || []).map(t => (typeof t === 'string' ? t : (t._id || t.id)));
  const myOrders = orders.filter(o => {
    const isDirectlyAssigned = o.assignedWaiterId && (o.assignedWaiterId._id || o.assignedWaiterId) === waiter?._id;
    const orderTableId = o.tableId?._id || o.tableId?.id || o.tableId;
    const isTableAssigned = myAssignedTableIds.includes(orderTableId);
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                waiter.shiftStatus === 'ON_SHIFT'
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {waiter.shiftStatus === 'ON_SHIFT' ? 'End Shift' : 'Start Shift'}
            </button>

            {waiter.shiftStatus === 'ON_SHIFT' && (
              <select
                value={waiter.availabilityStatus || 'AVAILABLE'}
                onChange={(e) => updateAvailability(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none"
              >
                <option value="AVAILABLE">Available</option>
                <option value="PAUSED">Break / Paused</option>
                <option value="OFF_SHIFT">Off Duty</option>
              </select>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ORDERS'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Clock size={16} />
            Active Orders ({myOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'REQUESTS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <HelpCircle size={16} />
            Service Requests ({serviceRequests.length})
          </button>
        </div>

        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${connected ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>

      {/* Active Orders List */}
      {activeTab === 'ORDERS' && (
        <div className="flex-1 overflow-y-auto">
          {myOrders.length === 0 ? (
            <div className="text-center py-20 text-gray-400 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
              <Bell size={48} className="mx-auto mb-4 opacity-50" />
              <p className="font-semibold text-gray-600">No active orders right now.</p>
              <p className="text-xs text-gray-400 mt-1">When customers place orders, they appear here instantly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {myOrders.map((order, idx) => {
                const isAlreadyAccepted = 
                  order.appStatus === 'ACCEPTED' || 
                  order.assignmentStatus === 'ACCEPTED' || 
                  ['ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].includes(order.status);

                const isNoOrder = order.status === 'NO_ORDER';

                const needsAcceptance = !isAlreadyAccepted && !isNoOrder && (
                  order.assignmentStatus === 'PENDING_ACCEPTANCE' ||
                  order.status === 'SUBMITTED' ||
                  order.status === 'ORDERED' ||
                  order.status === 'PENDING'
                );

                const isOverflow = order.assignmentType === 'OVERFLOW';

                return (
                  <div
                    key={order.id || idx}
                    className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 flex flex-col justify-between transition-all ${
                      isNoOrder
                        ? 'border-blue-500 ring-2 ring-blue-200/50 bg-blue-50/10'
                        : needsAcceptance
                        ? 'border-amber-500 ring-2 ring-amber-300/50 bg-amber-50/10'
                        : order.hasNewItems
                        ? 'border-amber-500 ring-2 ring-amber-300'
                        : 'border-emerald-600'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-lg text-gray-900">
                              Table {order.tableNumber || order.table || 'Takeaway'}
                            </h3>
                            {isOverflow && (
                              <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                OVERFLOW
                              </span>
                            )}
                            {order.hasNewItems && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 animate-pulse flex items-center gap-1">
                                <Sparkles size={10} /> MORE ITEMS
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{order.orderNumber || order.id?.substring(0, 8)}</p>
                          {order.customerName && order.customerName !== 'Guest' && (
                            <p className="text-[11px] text-gray-600 font-medium flex items-center gap-1 mt-1">
                              <User size={11} className="text-gray-400 shrink-0" />
                              <span className="truncate">{order.customerName} {order.customerPhone ? `(${order.customerPhone})` : ''}</span>
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-bold px-2.5 py-1 rounded-md text-[11px] inline-block ${
                              isNoOrder
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : needsAcceptance
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : order.status === 'PREPARING'
                                ? 'bg-blue-100 text-blue-800'
                                : order.status === 'READY'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'SERVED'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {isNoOrder ? 'TABLE OCCUPIED' : (needsAcceptance ? 'NEEDS ACCEPTANCE' : order.status)}
                          </span>
                        </div>
                      </div>

                      {/* Special Instructions Note */}
                      {order.specialInstructions && (
                        <div className="mb-3 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-1.5">
                          <FileText size={14} className="shrink-0 text-amber-600 mt-0.5" />
                          <span className="truncate"><strong>Note:</strong> {order.specialInstructions}</span>
                        </div>
                      )}

                      {/* Items List with Delete button or Empty placeholder for NO_ORDER */}
                      {isNoOrder && (!order.items || order.items.length === 0) ? (
                        <div className="py-5 px-3 bg-blue-50/50 border border-dashed border-blue-200 rounded-xl text-center text-xs text-blue-900 mb-4">
                          <p className="font-bold flex items-center justify-center gap-1.5"><QrCode size={15} className="text-blue-600" /> Table Occupied via QR Scan</p>
                          <p className="text-[11px] text-blue-700/80 mt-1">Customer has not placed any food order yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto pr-1 divide-y divide-gray-50">
                          {(order.items || []).map((item, i) => (
                            <div key={item.id || item._id || i} className="flex justify-between items-center text-sm text-gray-700 pt-1.5 first:pt-0">
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <span className="font-extrabold text-xs text-gray-900 shrink-0">{item.quantity || item.qty}x</span>
                                <span className="font-medium text-xs text-gray-800 truncate">{item.itemName || item.name}</span>
                                {item.size && (
                                  <span className="text-[9px] bg-gray-100 text-gray-600 px-1 py-0.2 rounded font-bold uppercase shrink-0">
                                    {item.size}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-gray-600 text-xs font-semibold">
                                  ₹{Number(item.subtotal ?? item.total ?? ((item.unitPrice || item.price || 0) * (item.quantity || item.qty || 1)) ?? 0).toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrderItem(order.id || order._id, item.id || item._id, item.itemName || item.name)}
                                  title="Delete item from order"
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Total & Timestamp */}
                      <div className="text-xs text-gray-400 mb-4 flex justify-between items-center border-t border-gray-100 pt-2">
                        <span>Total: <strong className="text-gray-800 text-sm">₹{Number(order.total || order.subtotal || 0).toFixed(2)}</strong></span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
                      {isNoOrder ? (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setStagedItems([]);
                              setAddSuccessMsg('');
                            }}
                            className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <PlusCircle size={15} /> Take Order (Add Items)
                          </button>
                          <button
                            onClick={() => handleCancelOccupation(order)}
                            className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <XCircle size={15} /> Cancel Occupation (Free Table)
                          </button>
                        </div>
                      ) : needsAcceptance ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptOrder(order.id || order._id)}
                              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <CheckCircle size={16} /> Accept Order
                            </button>
                            <button
                              onClick={() => handleRejectOrder(order.id || order._id)}
                              className="py-2.5 px-3 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <XCircle size={16} /> Reject
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setStagedItems([]);
                              setAddSuccessMsg('');
                            }}
                            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 size={15} /> Edit Order
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingOrder(order);
                                setStagedItems([]);
                                setAddSuccessMsg('');
                              }}
                              className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 size={14} /> Edit Order
                            </button>

                            {order.status !== 'SERVED' && (
                              <button 
                                onClick={() => updateOrderStatus(order.id || order._id, 'SERVED')}
                                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                              >
                                <Check size={14} /> Mark Served
                              </button>
                            )}
                          </div>

                          <button 
                            onClick={() => {
                              if (window.confirm(`Mark Table ${order.tableNumber || order.table}'s order as completed? This will free the table for new customers.`)) {
                                updateOrderStatus(order.id || order._id, 'COMPLETED');
                              }
                            }}
                            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                          >
                            <CheckCircle size={15} /> Complete (Free Table)
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
                        className="flex-1 py-2 border border-blue-600 text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => handleResolveRequest(req._id, 'RESOLVED')}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
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

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div>
                <h2 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <Edit3 size={18} className="text-emerald-600" />
                  Edit Order — Table {editingOrder.tableNumber || editingOrder.table || 'Takeaway'}
                </h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {editingOrder.orderNumber || editingOrder.id?.substring(0, 8)}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setStagedItems([]);
                  setAddSuccessMsg('');
                  fetchData();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Success Notification Banner */}
              {addSuccessMsg && (
                <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle size={16} className="text-emerald-700 shrink-0" />
                  <span>{addSuccessMsg}</span>
                </div>
              )}

              {/* Customer & Notes */}
              {(editingOrder.customerName || editingOrder.specialInstructions) && (
                <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3 text-xs text-amber-900 flex flex-col gap-1">
                  {editingOrder.customerName && (
                    <p><span className="font-bold">Customer:</span> {editingOrder.customerName} {editingOrder.customerPhone && `(${editingOrder.customerPhone})`}</p>
                  )}
                  {editingOrder.specialInstructions && (
                    <p><span className="font-bold">Instructions:</span> {editingOrder.specialInstructions}</p>
                  )}
                </div>
              )}

              {/* Current Order Items List with +/- and Delete */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Order Items ({(editingOrder.items || []).length})
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">
                    Total: <strong className="text-gray-900 font-extrabold">₹{Number(editingOrder.total || editingOrder.subtotal || 0).toFixed(2)}</strong>
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(editingOrder.items || []).length === 0 ? (
                    <div className="p-4 bg-gray-50 rounded-2xl text-center border border-dashed border-gray-200">
                      <p className="text-xs text-gray-400 italic">No items in this order yet. Add items below!</p>
                    </div>
                  ) : (
                    (editingOrder.items || []).map((item, idx) => {
                      const itemTotal = Number(item.subtotal ?? item.total ?? ((item.unitPrice || item.price || 0) * (item.quantity || 1)) ?? 0);
                      const unitPrice = Number(item.unitPrice || item.price || 0);
                      return (
                        <div key={item.id || item._id || idx} className="bg-gray-50 hover:bg-gray-100/80 rounded-2xl p-3 flex items-center justify-between gap-3 border border-gray-100 transition">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">{item.itemName || item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">₹{unitPrice.toFixed(2)} each</span>
                              {item.size && (
                                <span className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.2 rounded font-bold uppercase">
                                  {item.size}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center border border-gray-200 bg-white rounded-xl overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(editingOrder.id || editingOrder._id, item.id || item._id, (item.quantity || 1) - 1)}
                                className="p-1.5 hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                                title="Decrease quantity"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="px-2.5 text-xs font-extrabold text-gray-900 min-w-6 text-center">
                                {item.quantity || 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantity(editingOrder.id || editingOrder._id, item.id || item._id, (item.quantity || 1) + 1)}
                                className="p-1.5 hover:bg-gray-100 text-gray-600 transition cursor-pointer"
                                title="Increase quantity"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <span className="font-extrabold text-xs text-gray-900 w-16 text-right">
                              ₹{itemTotal.toFixed(2)}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDeleteOrderItem(editingOrder.id || editingOrder._id, item.id || item._id, item.itemName || item.name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add Items to Order Section */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <PlusCircle size={15} className="text-emerald-600" />
                    Add Multiple Items from Menu
                  </h3>
                  <span className="text-[11px] text-gray-400">Pick items to batch add</span>
                </div>

                <div className="space-y-2.5 bg-gray-50/70 p-3.5 rounded-2xl border border-gray-100">
                  {/* Search and Category Filter */}
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search dishes to add (e.g. Naan, Biryani, Drink)..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {menuSearch && (
                      <button
                        type="button"
                        onClick={() => setMenuSearch('')}
                        className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs p-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  {Array.from(new Set(menuItems.map(m => m.category).filter(Boolean))).length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {['ALL', ...Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)))].map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition cursor-pointer ${
                            selectedCategory === cat ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dishes list */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {menuItems
                      .filter(m => {
                        const matchSearch = !menuSearch || 
                          m.name?.toLowerCase().includes(menuSearch.toLowerCase()) || 
                          m.category?.toLowerCase().includes(menuSearch.toLowerCase());
                        const matchCat = selectedCategory === 'ALL' || m.category === selectedCategory;
                        return matchSearch && matchCat;
                      })
                      .slice(0, 30)
                      .map(m => {
                        const mId = m.id || m._id;
                        const hasSizes = m.quantities && m.quantities.length > 0;
                        const stagedForThis = stagedItems.filter(si => si.menuItemId === mId);
                        const totalStagedForThis = stagedForThis.reduce((sum, si) => sum + si.quantity, 0);

                        return (
                          <div
                            key={mId}
                            className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 ${
                              totalStagedForThis > 0 ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/60' : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${m.dietaryPreference === 'VEG' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  <p className="font-bold text-xs text-gray-900 truncate">{m.name}</p>
                                </div>
                                {m.category && (
                                  <span className="text-[10px] text-gray-400 font-medium ml-3.5">{m.category}</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-extrabold text-xs text-emerald-700">
                                  ₹{parseFloat(m.price || 0).toFixed(2)}
                                </span>

                                {!hasSizes && (
                                  <div>
                                    {totalStagedForThis > 0 ? (
                                      <div className="flex items-center border border-emerald-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateStagedItemQty(`${mId}_default`, -1)}
                                          className="p-1 hover:bg-emerald-50 text-emerald-800 transition cursor-pointer"
                                        >
                                          <Minus size={11} />
                                        </button>
                                        <span className="px-2 text-xs font-black text-emerald-900 min-w-4 text-center">
                                          {totalStagedForThis}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleStageItem(m, '', 1)}
                                          className="p-1 hover:bg-emerald-50 text-emerald-800 transition cursor-pointer"
                                        >
                                          <Plus size={11} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleStageItem(m, '', 1)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                                      >
                                        <Plus size={12} /> Add
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Size buttons if dish has variants */}
                            {hasSizes && (
                              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                                {m.quantities.map(q => {
                                  const stageKey = `${mId}_${q.size}`;
                                  const inStage = stagedItems.find(si => si.stageKey === stageKey);
                                  return (
                                    <div key={q.size} className="flex items-center">
                                      {inStage ? (
                                        <div className="flex items-center border border-emerald-400 bg-white rounded-lg overflow-hidden shadow-2xs text-[10px]">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateStagedItemQty(stageKey, -1)}
                                            className="px-1.5 py-0.5 hover:bg-emerald-50 text-emerald-800 cursor-pointer"
                                          >
                                            <Minus size={10} />
                                          </button>
                                          <span className="px-1.5 font-black text-emerald-900 uppercase">
                                            {q.size}: {inStage.quantity}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateStagedItemQty(stageKey, 1)}
                                            className="px-1.5 py-0.5 hover:bg-emerald-50 text-emerald-800 cursor-pointer"
                                          >
                                            <Plus size={10} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleStageItem(m, q.size, 1)}
                                          className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-900 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                                        >
                                          <span>{q.size} (₹{q.price})</span>
                                          <Plus size={10} className="text-emerald-600" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Ready to Add to Order Staging Tray */}
                  {stagedItems.length > 0 && (
                    <div className="bg-emerald-50/80 border-2 border-emerald-400 rounded-2xl p-3.5 shadow-sm space-y-3 mt-3 animate-fadeIn">
                      <div className="flex justify-between items-center pb-2 border-b border-emerald-200">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={15} className="text-emerald-700" />
                          <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                            Items Ready to Add ({stagedItems.reduce((s, i) => s + i.quantity, 0)} items)
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStagedItems([])}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>

                      {/* Staged Items List */}
                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {stagedItems.map(si => (
                          <div
                            key={si.stageKey}
                            className="bg-white p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-xs text-gray-900 truncate">{si.name}</p>
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span>₹{si.unitPrice.toFixed(2)} each</span>
                                {si.size && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1 rounded uppercase">
                                    {si.size}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStagedItemQty(si.stageKey, -1)}
                                  className="p-1 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                                  title="Decrease"
                                >
                                  <Minus size={11} />
                                </button>
                                <span className="px-2 text-xs font-black text-gray-900 min-w-4 text-center">
                                  {si.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStagedItemQty(si.stageKey, 1)}
                                  className="p-1 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                                  title="Increase"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>

                              <span className="font-extrabold text-xs text-gray-900 w-14 text-right">
                                ₹{si.total.toFixed(2)}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveStagedItem(si.stageKey)}
                                className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Submit All Staged Items Button */}
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleAddStagedItemsToOrder(editingOrder.id || editingOrder._id)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check size={16} />
                        {isSubmitting
                          ? 'Adding Items to Order...'
                          : `Add ${stagedItems.reduce((s, i) => s + i.quantity, 0)} Item${stagedItems.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''} to Order • ₹${stagedItems.reduce((s, i) => s + i.total, 0).toFixed(2)}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-medium">Updated Bill Total:</span>
                <p className="text-lg font-extrabold text-emerald-700">
                  ₹{Number(editingOrder.total || editingOrder.subtotal || 0).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setStagedItems([]);
                  setAddSuccessMsg('');
                  fetchData();
                }}
                className="px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Done Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
