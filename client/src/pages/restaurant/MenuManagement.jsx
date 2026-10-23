import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, X, Image as ImageIcon, Tag, Filter, ToggleLeft, ToggleRight, Loader2, FolderPlus, Edit2, Search } from 'lucide-react';
import { useSocketEvents } from '../../lib/socket';

const DIET_TYPES = [
  { value: 'ALL', label: 'All Types', color: 'gray' },
  { value: 'VEG', label: 'Veg', color: 'green' },
  { value: 'NON_VEG', label: 'Non-Veg', color: 'red' },
];

const DIET_BADGE = {
  VEG: 'bg-green-100 text-green-700',
  NON_VEG: 'bg-red-100 text-red-700',
};

export default function MenuManagement() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [activeDiet, setActiveDiet] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    dietaryPreference: 'VEG',
    preparationTime: '15'
  });
  const [quantities, setQuantities] = useState([]);
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchMenu();
  }, []);

  const getHeaders = (isFormData = false) => {
    const token = localStorage.getItem('token');
    const hostname = window.location.hostname;
    const headers = { 'Authorization': `Bearer ${token}` };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    let subdomain = '';
    if (hostname.includes('dynease.in') && hostname !== 'dynease.in' && hostname !== 'www.dynease.in') {
      subdomain = hostname.split('.')[0];
    } else if (hostname.includes('localhost') && hostname !== 'localhost') {
      subdomain = hostname.split('.')[0];
    }
    if (subdomain) headers['x-tenant-subdomain'] = subdomain;
    return headers;
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/categories`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) setCategories(data.data.categories);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/menu`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) setItems(data.data.menuItems);
    } catch (err) {
      console.error(err);
    }
  };

  // Realtime: pick up menu changes made from other sessions/tabs.
  useSocketEvents({
    menu_updated: () => {
      fetchCategories();
      fetchMenu();
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const data = new FormData();
    data.append('name', formData.name);
    data.append('category', formData.category);
    data.append('description', formData.description);
    data.append('price', formData.price);
    data.append('dietaryPreference', formData.dietaryPreference);
    data.append('preparationTime', formData.preparationTime);
    const cleanQuantities = quantities
      .filter(q => q.size && q.size.trim() && q.price !== '' && !isNaN(q.price))
      .map(q => ({ size: q.size.trim(), price: Number(q.price) }));
    data.append('quantities', JSON.stringify(cleanQuantities));
    if (imageFile) data.append('image', imageFile);

    try {
      const url = editingItem 
        ? `${import.meta.env.VITE_API_URL}/restaurant/menu/${editingItem._id}` 
        : `${import.meta.env.VITE_API_URL}/restaurant/menu`;
      
      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: getHeaders(true),
        body: data
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setEditingItem(null);
        setFormData({ name: '', category: '', description: '', price: '', dietaryPreference: 'VEG', preparationTime: '15' });
        setQuantities([]);
        setImageFile(null);
        fetchMenu();
      } else {
        alert(json.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error saving item.');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: item.price,
      dietaryPreference: (item.dietaryPreference || '').toUpperCase().includes('NON') ? 'NON_VEG' : 'VEG',
      preparationTime: item.preparationTime || '15'
    });
    setQuantities(item.quantities || []);
    setImageFile(null);
    setShowAddModal(true);
  };


  const handleDelete = async (id) => {
    if (!window.confirm('Delete this menu item?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/menu/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) setItems(prev => prev.filter(i => i._id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleAvailability = async (item) => {
    setTogglingId(item._id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/menu/${item._id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ isAvailable: !item.isAvailable })
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.map(i => i._id === item._id ? data.data.menuItem : i));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  // Filtered items
  const filtered = items.filter(item => {
    const catMatch = activeCategory === 'ALL' || item.category === activeCategory;
    const isItemNonVeg = (item.dietaryPreference || '').toUpperCase().includes('NON');
    let dietMatch = true;
    if (activeDiet === 'VEG') dietMatch = !isItemNonVeg;
    else if (activeDiet === 'NON_VEG') dietMatch = isItemNonVeg;
    const searchMatch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return catMatch && dietMatch && searchMatch;
  });

  const allCategories = ['ALL', ...categories.map(c => c.name)];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h2 className="text-xl font-bold text-gray-800">Menu Management</h2>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => navigate('/restaurant/categories')}
            className="border border-green-300 text-green-600 hover:bg-green-50 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
          >
            <FolderPlus size={16} /> Manage Categories
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormData({ name: '', category: '', description: '', price: '', dietaryPreference: 'VEG', preparationTime: '15' });
              setQuantities([]);
              setImageFile(null);
              setShowAddModal(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
          >
            <Plus size={16} /> Add Dish
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold">
            <Filter size={15} /> Filters
          </div>
          
          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Tag size={12} /> Category
          </p>
          <div className="flex flex-wrap gap-2">
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeCategory === cat
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
                {cat !== 'ALL' && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({items.filter(i => i.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Type</p>
          <div className="flex flex-wrap gap-2">
            {DIET_TYPES.map(dt => (
              <button
                key={dt.value}
                onClick={() => setActiveDiet(dt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeDiet === dt.value
                    ? 'bg-gray-800 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {dt.label}
                {dt.value !== 'ALL' && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({items.filter(i => {
                      const isNon = (i.dietaryPreference || '').toUpperCase().includes('NON');
                      return dt.value === 'NON_VEG' ? isNon : !isNon;
                    }).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Showing <span className="font-bold text-gray-600">{filtered.length}</span> of {items.length} items
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-4 font-semibold text-gray-600 text-sm">Item</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Category</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Price</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Type</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Available</th>
              <th className="p-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-10 text-center text-gray-400">
                  {items.length === 0 ? 'No items yet. Add your first dish!' : 'No items match the selected filters.'}
                </td>
              </tr>
            ) : filtered.map(item => (
              <tr key={item._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {item.image?.secure_url ? (
                      <img src={item.image.secure_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{item.name}</div>
                      <div className="text-xs text-gray-400 max-w-[180px] truncate">{item.description}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="bg-green-50 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                    {item.category}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-bold text-green-600">₹{item.price}</div>
                  {item.quantities && item.quantities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 max-w-[220px]">
                      {item.quantities.map((q, qIdx) => (
                        <span key={qIdx} className="bg-emerald-50 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                          {q.size}: ₹{q.price}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit ${
                      (item.dietaryPreference || '').toUpperCase().includes('NON')
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        (item.dietaryPreference || '').toUpperCase().includes('NON') ? 'bg-red-600' : 'bg-green-600'
                      }`} />
                      {(item.dietaryPreference || '').toUpperCase().includes('NON') ? 'Non-Veg' : 'Veg'}
                    </span>
                    {item.quantities && item.quantities.length > 0 && (
                      <span className="text-[11px] text-gray-500 font-medium">
                        {item.quantities.length} size{item.quantities.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleToggleAvailability(item)}
                    disabled={togglingId === item._id}
                    className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    {togglingId === item._id ? (
                      <Loader2 size={18} className="animate-spin text-gray-400" />
                    ) : item.isAvailable ? (
                      <><ToggleRight size={24} className="text-green-500" /><span className="text-green-600">On</span></>
                    ) : (
                      <><ToggleLeft size={24} className="text-gray-400" /><span className="text-gray-400">Off</span></>
                    )}
                  </button>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Edit Item"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id)}
                      disabled={deletingId === item._id}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Item"
                    >
                      {deletingId === item._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add Dish Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">{editingItem ? 'Edit Dish' : 'Add New Dish'}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-200 transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Dish Name *</label>
                  <input type="text" name="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm" placeholder="e.g. Paneer Tikka" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Price (₹) *</label>
                  <input type="number" name="price" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required min="0" className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm" placeholder="249" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Category *</label>
                  {categories.length > 0 ? (
                    <select name="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm">
                      <option value="">Select category</option>
                      {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                    </select>
                  ) : (
                    <div className="w-full p-2.5 border border-dashed border-green-300 rounded-lg text-xs text-green-500 bg-green-50">
                      No categories yet. <button type="button" onClick={() => navigate('/restaurant/categories')} className="font-bold underline">Add one first.</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Type *</label>
                  <select
                    name="dietaryPreference"
                    value={(formData.dietaryPreference || '').toUpperCase().includes('NON') ? 'NON_VEG' : 'VEG'}
                    onChange={e => setFormData({...formData, dietaryPreference: e.target.value})}
                    className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm"
                  >
                    <option value="VEG">🟢 Veg</option>
                    <option value="NON_VEG">🔴 Non-Veg</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Description</label>
                <textarea name="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm" rows="2" placeholder="Delicious grilled cottage cheese..." />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">Photo (Optional)</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setImageFile(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`w-full p-6 border-2 border-dashed rounded-lg text-center transition-colors ${
                    isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <input 
                    type="file" 
                    id="menuImageUpload"
                    accept="image/*" 
                    onChange={e => setImageFile(e.target.files[0])} 
                    className="hidden" 
                  />
                  <label htmlFor="menuImageUpload" className="cursor-pointer flex flex-col items-center">
                    <ImageIcon size={32} className={`mb-2 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
                    {imageFile ? (
                      <span className="text-sm font-medium text-green-600 truncate max-w-full px-4">{imageFile.name}</span>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-gray-700">Click to upload or drag & drop</span>
                        <span className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Quantity / Portion Variants */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800">Portions / Quantities & Pricing (Optional)</label>
                    <p className="text-xs text-gray-500">Mention portion sizes (Half, Full, Small, Medium, Large, Jumbo) and their prices</p>
                  </div>
                </div>

                {/* Quick Add Presets */}
                <div className="mb-3 flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-medium text-gray-500 mr-1">Quick Add:</span>
                  {['Half', 'Full', 'Small', 'Medium', 'Large', 'Jumbo'].map(preset => {
                    const alreadyAdded = quantities.some(q => q.size.toLowerCase() === preset.toLowerCase());
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (!alreadyAdded) {
                            setQuantities([...quantities, { size: preset, price: '' }]);
                          }
                        }}
                        disabled={alreadyAdded}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                          alreadyAdded
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 active:scale-95'
                        }`}
                      >
                        + {preset}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setQuantities([...quantities, { size: '', price: '' }])}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    + Custom
                  </button>
                </div>

                <datalist id="sizePresetOptions">
                  <option value="Half" />
                  <option value="Full" />
                  <option value="Small" />
                  <option value="Medium" />
                  <option value="Large" />
                  <option value="Jumbo" />
                </datalist>
                
                {quantities.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {quantities.map((qty, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <label className="text-[11px] text-gray-500 font-semibold block mb-0.5">Quantity / Size</label>
                          <input
                            type="text"
                            list="sizePresetOptions"
                            value={qty.size}
                            onChange={(e) => {
                              const newQty = [...quantities];
                              newQty[idx].size = e.target.value;
                              setQuantities(newQty);
                            }}
                            placeholder="e.g. Half, Full, Small, Medium, Large, Jumbo"
                            className="w-full p-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-green-500 bg-white"
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-[11px] text-gray-500 font-semibold block mb-0.5">Price (₹)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₹</span>
                            <input
                              type="number"
                              value={qty.price}
                              onChange={(e) => {
                                const newQty = [...quantities];
                                newQty[idx].price = e.target.value;
                                setQuantities(newQty);
                                // If base price is empty, optionally fill with first variant price
                                if (!formData.price && e.target.value) {
                                  setFormData(prev => ({ ...prev, price: e.target.value }));
                                }
                              }}
                              placeholder="0"
                              min="0"
                              className="w-full pl-6 p-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-green-500 bg-white"
                            />
                          </div>
                        </div>
                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={() => setQuantities(quantities.filter((_, i) => i !== idx))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Remove variant"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors text-sm">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2">
                  {isLoading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Save Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
