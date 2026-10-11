import React, { useState } from 'react';
import { ArrowLeft, Minus, Plus, ShoppingBag, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ItemDescription() {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState([]);

  const item = {
    id: 1,
    name: 'Chicken Dum Biryani',
    price: 299,
    type: 'non-veg',
    rating: 4.8,
    reviews: 124,
    img: 'https://placehold.co/600x400/orange/white?text=Chicken+Biryani',
    desc: 'Authentic Hyderabadi style chicken dum biryani, cooked with aromatic basmati rice and our secret blend of spices. Served with raita and salan.',
    addons: [
      { id: 'a1', name: 'Extra Chicken Piece', price: 60 },
      { id: 'a2', name: 'Double Masala', price: 30 },
      { id: 'a3', name: 'Boiled Egg', price: 20 },
    ]
  };

  const handleAddonToggle = (id) => {
    setSelectedAddons(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const calculateTotal = () => {
    let base = item.price * quantity;
    let addonsCost = selectedAddons.reduce((acc, id) => {
      const addon = item.addons.find(a => a.id === id);
      return acc + (addon ? addon.price * quantity : 0);
    }, 0);
    return base + addonsCost;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative pb-28 shadow-2xl">
      <div className="relative h-72">
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-gray-800 transition-colors hover:bg-white"
        >
          <ArrowLeft size={20} />
        </button>
        <button 
          onClick={() => setFavorite(!favorite)}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-sm text-gray-800 transition-colors hover:bg-white"
        >
          <Heart size={20} className={favorite ? "fill-red-500 text-red-500" : ""} />
        </button>
        <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
      </div>

      <div className="bg-white -mt-6 rounded-t-3xl p-6 relative flex-1">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${item.type === 'veg' ? 'bg-green-500' : 'bg-red-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'veg' ? 'bg-white' : 'bg-white'}`} />
          </div>
          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
            ⭐ {item.rating} ({item.reviews})
          </span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{item.name}</h1>
        <p className="text-3xl font-extrabold text-green-600 mb-4">₹{item.price}</p>
        
        <p className="text-gray-600 leading-relaxed mb-8 font-medium">
          {item.desc}
        </p>

        <div className="border-t border-gray-100 pt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Add-ons</h3>
          <div className="space-y-3">
            {item.addons.map(addon => (
              <label key={addon.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${selectedAddons.includes(addon.id) ? 'border-green-500 bg-green-50/50' : 'border-gray-200 hover:border-green-300'}`}>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    checked={selectedAddons.includes(addon.id)}
                    onChange={() => handleAddonToggle(addon.id)}
                    className="w-5 h-5 accent-green-600 rounded cursor-pointer" 
                  />
                  <span className="font-semibold text-gray-800">{addon.name}</span>
                </div>
                <span className="font-bold text-gray-600">+₹{addon.price}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="border-t border-gray-100 pt-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Special Instructions</h3>
          <textarea 
            placeholder="E.g., Make it extra spicy..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all font-medium"
            rows="3"
          ></textarea>
        </div>
      </div>

      <div className="fixed bottom-0 w-full max-w-md bg-white p-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] border-t border-gray-100 z-20 flex gap-4">
        <div className="flex items-center gap-4 bg-gray-100 rounded-2xl px-2 py-2 w-1/3 justify-between">
          <button 
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-gray-800 hover:bg-gray-50 transition-colors"
          >
            <Minus size={20} />
          </button>
          <span className="font-bold text-lg">{quantity}</span>
          <button 
            onClick={() => setQuantity(quantity + 1)}
            className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shadow-sm text-green-600 hover:bg-green-200 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
        
        <button className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-2xl flex items-center justify-center gap-3 font-bold text-lg shadow-lg shadow-green-200 transition-all hover:-translate-y-0.5">
          Add Item • ₹{calculateTotal()}
        </button>
      </div>
    </div>
  );
}
