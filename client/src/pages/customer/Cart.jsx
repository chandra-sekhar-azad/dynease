import React, { useState, useRef } from 'react';
import { Minus, Plus, ShoppingBag, ArrowLeft, Trash2, Receipt, Loader2, CheckCircle2, FileText, User, Phone, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';

export default function Cart() {
  const navigate = useNavigate();
  const {
    session,
    cart,
    cartCount,
    cartSubtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
    addOrderId,
    liveOrdersCount,
    latestLiveOrder
  } = useRestaurant();

  const [specialInstructions, setSpecialInstructions] = useState('');
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('customerName') || session?.customerName || '';
    } catch {
      return '';
    }
  });
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('customerPhone') || session?.customerPhone || '';
    } catch {
      return '';
    }
  });
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState('');

  const tableLabel = session?.table?.tableNumber ? `Table ${session.table.tableNumber}` : null;
  const restaurantName = session?.restaurant?.name || 'Restaurant';
  const taxPercent = session?.restaurant?.taxPercent || 0;
  const taxAmount = parseFloat(((cartSubtotal * taxPercent) / 100).toFixed(2));
  const total = parseFloat((cartSubtotal + taxAmount).toFixed(2));

  const handlePlaceOrder = async () => {
    if (isSubmittingRef.current || loading) return;

    if (!session?.table?.id) {
      setError('No active table session found. Please scan a table QR code to place an order.');
      return;
    }
    if (cart.length === 0) {
      setError('Your cart is empty. Please add items to place an order.');
      return;
    }

    isSubmittingRef.current = true;
    setError('');
    setLoading(true);

    try {
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      const idempotencyKey = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

      const body = {
        tableId: session.table.id,
        customerName: trimmedName || localStorage.getItem('customerName') || 'Guest',
        customerPhone: trimmedPhone || localStorage.getItem('customerPhone') || undefined,
        items: cart.map(i => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          size: i.size || undefined
        })),
        specialInstructions: specialInstructions.trim() || undefined,
        orderId: latestLiveOrder?.id || undefined,
        idempotencyKey
      };

      const res = await fetch(`${import.meta.env.VITE_API_URL}/public/orders`, {
        method: 'POST',
        headers: {
          ...getTenantHeaders(),
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success && data.data?.order) {
        clearCart();
        addOrderId(data.data.order.id);

        if (trimmedPhone) {
          try { localStorage.setItem('customerPhone', trimmedPhone); } catch {}
        }
        if (trimmedName && trimmedName !== 'Guest') {
          try { localStorage.setItem('customerName', trimmedName); } catch {}
        }

        navigate(`/order/${data.data.order.id}`, { state: { order: data.data.order } });
      } else {
        setError(data.message || 'Failed to place order. Please try again.');
      }
    } catch (err) {
      console.error('Order placement error:', err);
      setError('Network connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md md:max-w-2xl lg:max-w-3xl mx-auto relative shadow-2xl">
      {/* Header */}
      <header className="bg-white px-4 py-4 flex items-center gap-3 shadow-xs sticky top-0 z-20 border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          title="Back"
        >
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{restaurantName}</h1>
          {tableLabel && <p className="text-xs text-gray-500 font-medium">{tableLabel}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tableLabel && (
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
              {tableLabel}
            </span>
          )}
          <Link
            to="/orders"
            className="relative p-2.5 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors shrink-0"
            title="My Orders"
          >
            <Receipt size={20} />
            {liveOrdersCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-extrabold text-white shadow-xs animate-pulse">
                {liveOrdersCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="flex-1 p-4 pb-40 space-y-4">
        {/* Active dining round alert notice */}
        {latestLiveOrder && cart.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Adding to Current Order</p>
              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                Items will be appended to your active order ({latestLiveOrder.orderNumber || `#${String(latestLiveOrder.id).substring(0, 8)}`}).
              </p>
            </div>
          </div>
        )}

        {cart.length > 0 ? (
          <>
            {/* Items List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                  Your Order ({cartCount} {cartCount === 1 ? 'item' : 'items'})
                </h2>
                <button
                  onClick={clearCart}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                >
                  Clear Cart
                </button>
              </div>

              {cart.map((item, idx) => (
                <div
                  key={item.size ? `${item.menuItemId}_${item.size}` : `${item.menuItemId}_${idx}`}
                  className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4 flex gap-3 items-center transition-all hover:border-gray-200"
                >
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-gray-100 border border-gray-100"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${
                        (item.dietaryPreference || '').toUpperCase().includes('NON') ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{item.name}</h3>
                      {item.size && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                          {item.size}
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-700 font-bold text-sm mb-2">₹{item.price}</p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                        <button
                          onClick={() => updateQuantity(item.menuItemId, item.quantity - 1, item.size)}
                          className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs text-gray-600 hover:bg-gray-50 cursor-pointer active:scale-95 transition-transform"
                          title="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="font-bold text-sm w-7 text-center text-gray-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, item.quantity + 1, item.size)}
                          className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center shadow-xs text-white hover:bg-emerald-700 cursor-pointer active:scale-95 transition-transform"
                          title="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 text-sm">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.menuItemId, item.size)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Special Instructions */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2 text-gray-700 font-semibold text-sm">
                <FileText size={16} className="text-gray-400" />
                <span>Special Cooking Instructions (Optional)</span>
              </div>
              <input
                type="text"
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="e.g. Less spicy, extra sauce, allergy info..."
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Optional Customer Contact Details */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4">
              <button
                type="button"
                onClick={() => setShowContactDetails(!showContactDetails)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <User size={16} className="text-gray-400" />
                  <span>Your Details <span className="text-xs text-gray-400 font-normal">({name || phone ? `${name || 'Guest'} · ${phone || 'No phone'}` : 'optional'})</span></span>
                </div>
                <span className="text-xs text-emerald-600 font-bold hover:underline">
                  {showContactDetails ? 'Hide' : 'Edit'}
                </span>
              </button>

              {showContactDetails && (
                <div className="mt-3 space-y-3 pt-3 border-t border-gray-100 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-gray-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-gray-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bill Details */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-5">
              <h3 className="font-bold mb-3 text-gray-800 text-sm">Bill Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Item Total ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                  <span className="font-medium text-gray-900">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                {taxPercent > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Taxes & Charges ({taxPercent}%)</span>
                    <span className="font-medium text-gray-900">₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-100 mt-2 pt-3 flex justify-between font-extrabold text-gray-900 text-base">
                  <span>To Pay</span>
                  <span className="text-emerald-700 text-lg">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl font-medium animate-in fade-in">
                {error}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center mt-20 py-8">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-5 text-emerald-600 shadow-xs">
              <ShoppingBag size={44} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-xs">
              Explore our delicious menu items and add them to your cart to order.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full max-w-xs">
              <Link
                to="/"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-200 transition-colors text-center text-sm cursor-pointer"
              >
                Browse Menu
              </Link>
              <Link
                to="/orders"
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-6 py-3.5 rounded-2xl font-bold transition-colors text-center text-sm"
              >
                View My Orders
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Place Order CTA - Direct button, NO checkout page needed */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-white border-t border-gray-100 p-4 shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.12)] z-30">
          <button
            onClick={handlePlaceOrder}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 text-white py-4 px-6 rounded-2xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-200 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                <span>{latestLiveOrder ? 'Adding Items to Order…' : 'Placing Your Order…'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={22} />
                <span>{latestLiveOrder ? 'Add to Current Order' : 'Place Order'} · ₹{total.toFixed(2)}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
