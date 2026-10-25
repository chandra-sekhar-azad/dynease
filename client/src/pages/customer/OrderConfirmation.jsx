import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { Loader2, CheckCircle, UtensilsCrossed, Clock } from 'lucide-react';
import { getTenantHeaders } from '../../context/RestaurantContext';
import { getSocket } from '../../lib/socket';

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState('');
  const hasOrderRef = useRef(Boolean(location.state?.order));

  useEffect(() => {
    let cancelled = false;

    const fetchOrder = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/public/orders/${orderId}`, {
          headers: getTenantHeaders()
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          hasOrderRef.current = true;
          setOrder(data.data.order);
        } else if (!hasOrderRef.current) {
          setError('Order not found.');
        }
      } catch {
        if (!cancelled && !hasOrderRef.current) {
          setError('Network error. Could not load order.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrder();

    // Realtime: keep the tracking status in sync with the kitchen.
    const socket = getSocket();
    if (orderId) socket.emit('customer:join', orderId);
    const onOrderUpdated = (updated) => {
      const updatedId = (updated?.id || updated?._id)?.toString();
      if (!updatedId || updatedId === String(orderId)) fetchOrder();
    };
    socket.on('order_updated', onOrderUpdated);
    socket.on('more_items_added', onOrderUpdated);

    return () => {
      cancelled = true;
      socket.off('order_updated', onOrderUpdated);
      socket.off('more_items_added', onOrderUpdated);
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-green-500 w-10 h-10" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
        <p className="text-gray-500">{error || 'Order details not found.'}</p>
      </div>
    );
  }

  const grandTotal = Number(order.total ?? order.totalAmount ?? order.final_amount ?? order.subtotal ?? 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Success Banner */}
        <div className="bg-gradient-to-r from-green-500 to-amber-500 p-8 text-center text-white">
          <CheckCircle size={56} className="mx-auto mb-3 drop-shadow-md" />
          <h1 className="text-2xl font-extrabold mb-1">Order Placed! 🎉</h1>
          <p className="text-green-100 text-sm">Your order has been sent to the kitchen</p>
        </div>

        {/* Order Info */}
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center bg-green-50 rounded-2xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 font-medium">Order Number</p>
              <p className="text-xl font-extrabold text-green-600">{order.orderNumber || order.id || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Table</p>
              <p className="text-xl font-extrabold text-gray-900">{order.tableNumber || order.tableId || 'N/A'}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide mb-2">Items Ordered</h3>
            <div className="space-y-2">
              {(order.items || []).map((item, idx) => {
                const itemTotal = Number(
                  item.subtotal ??
                  item.total ??
                  ((item.unitPrice || item.price || 0) * (item.quantity || 1)) ??
                  0
                );
                return (
                  <div key={item.id || idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.itemName || item.name || 'Item'}{' '}
                      <span className="text-gray-400">× {item.quantity || 1}</span>
                    </span>
                    <span className="font-semibold text-gray-900">₹{itemTotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-extrabold text-gray-900">
              <span>Total</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <UtensilsCrossed size={20} className="text-green-500" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Status: {order.status || 'SUBMITTED'}</p>
              <p className="text-xs text-gray-500">Our team will prepare your order shortly</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 pt-2">
            <Link
              to="/orders"
              className="w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Clock size={16} />
              <span>Track Live Order Status</span>
            </Link>
            <Link
              to="/"
              className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Order More Items
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
