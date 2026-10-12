import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, X, Eye, Sparkles, Image as ImageIcon, ExternalLink, Check } from 'lucide-react';

const DEFAULT_BANNER_IMAGE = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';

export default function AdsManagement() {
  const [ads, setAds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    badge: "CHEF'S SPECIAL",
    buttonText: 'Order Now',
    rightBadge: 'SPECIAL',
    imageUrl: '',
    targetUrl: '',
    status: 'Active'
  });

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/ads`);
      const data = await res.json();
      if (data.success) setAds(data.data.ads || []);
    } catch (err) {
      console.error('Failed to fetch banners', err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      title: "Today's Chef Specials",
      subtitle: 'Handcrafted seasonal treats prepared fresh to order.',
      badge: "CHEF'S SPECIAL",
      buttonText: 'Order Now',
      rightBadge: 'FRESH TODAY',
      imageUrl: '',
      targetUrl: '',
      status: 'Active'
    });
    setShowModal(true);
  };

  const openEditModal = (ad) => {
    setIsEditing(true);
    setEditingId(ad._id);
    setFormData({
      title: ad.title || '',
      subtitle: ad.subtitle || '',
      badge: ad.badge || "CHEF'S SPECIAL",
      buttonText: ad.buttonText || '',
      rightBadge: ad.rightBadge || '',
      imageUrl: ad.imageUrl || '',
      targetUrl: ad.targetUrl || '',
      status: ad.status || 'Active'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const url = isEditing 
        ? `${import.meta.env.VITE_API_URL}/admin/ads/${editingId}` 
        : `${import.meta.env.VITE_API_URL}/admin/ads`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchAds();
      } else {
        alert(data.message || 'Failed to save banner');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/ads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAds(ads.filter(ad => ad._id !== id));
      } else {
        alert(data.message || 'Failed to delete');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-amber-500" size={24} />
            Customer Menu Banners
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage two-part promotional banners (Left Content + Right Visual) displayed on customer digital menus.
          </p>
        </div>
        <button 
          onClick={openAddModal} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus size={18} /> Add New Banner
        </button>
      </div>
      
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ads.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <ImageIcon className="mx-auto text-gray-300 mb-3" size={48} />
            <h3 className="text-lg font-bold text-gray-800">No Banners Configured Yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Add your first two-part banner to highlight chef recommendations, daily discounts, and special offers.
            </p>
            <button 
              onClick={openAddModal}
              className="mt-5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all"
            >
              <Plus size={16} /> Create Banner
            </button>
          </div>
        ) : (
          ads.map((ad) => (
            <div key={ad._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
              
              {/* Banner Live Representation Card */}
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center justify-between">
                  <span>Customer Menu Preview</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ad.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {ad.status}
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-950 text-white shadow p-3 border border-emerald-700/50">
                  <div className="grid grid-cols-12 items-center gap-2">
                    
                    {/* Left Part */}
                    <div className="col-span-7 flex flex-col justify-between">
                      <div>
                        {ad.badge && (
                          <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full mb-1">
                            {ad.badge}
                          </span>
                        )}
                        <h4 className="font-serif font-bold text-sm text-white line-clamp-1 leading-tight">
                          {ad.title}
                        </h4>
                        {ad.subtitle && (
                          <p className="text-[11px] text-emerald-100/80 line-clamp-2 mt-0.5 font-light">
                            {ad.subtitle}
                          </p>
                        )}
                      </div>
                      {ad.buttonText && (
                        <span className="mt-2 inline-flex items-center text-[10px] font-bold bg-white/95 text-emerald-950 px-2 py-0.5 rounded self-start">
                          {ad.buttonText} →
                        </span>
                      )}
                    </div>

                    {/* Right Part */}
                    <div className="col-span-5 relative h-24 rounded-lg overflow-hidden bg-black/20">
                      <img 
                        src={ad.imageUrl} 
                        alt={ad.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                      {ad.rightBadge && (
                        <span className="absolute top-1 right-1 bg-rose-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded shadow uppercase">
                          {ad.rightBadge}
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 bg-white flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {ad.targetUrl ? (
                    <a href={ad.targetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline">
                      <ExternalLink size={12} /> {ad.targetUrl}
                    </a>
                  ) : (
                    <span>No link assigned</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openEditModal(ad)} 
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium text-xs flex items-center gap-1 transition-colors"
                  >
                    <Edit size={16} /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(ad._id)} 
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg font-medium text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Modal for Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                {isEditing ? 'Edit Two-Part Banner' : 'Create New Two-Part Banner'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
              
              {/* Live Preview Box */}
              <div className="border border-emerald-200 bg-emerald-50/50 p-3.5 rounded-xl space-y-2">
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                  Live Interactive Banner Preview:
                </span>
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-950 text-white p-3.5 shadow">
                  <div className="grid grid-cols-12 items-center gap-3">
                    {/* Left Part Preview */}
                    <div className="col-span-7">
                      {formData.badge && (
                        <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full mb-1">
                          {formData.badge}
                        </span>
                      )}
                      <h4 className="font-serif font-bold text-sm text-white line-clamp-1 leading-tight">
                        {formData.title || 'Banner Title'}
                      </h4>
                      <p className="text-[11px] text-emerald-100/90 line-clamp-2 mt-0.5 font-light">
                        {formData.subtitle || 'Banner subtitle description goes here.'}
                      </p>
                      {formData.buttonText && (
                        <span className="mt-2 inline-flex items-center text-[10px] font-bold bg-white text-emerald-950 px-2 py-0.5 rounded">
                          {formData.buttonText} →
                        </span>
                      )}
                    </div>

                    {/* Right Part Preview */}
                    <div className="col-span-5 relative h-24 rounded-lg overflow-hidden bg-black/25">
                      <img 
                        src={formData.imageUrl || DEFAULT_BANNER_IMAGE} 
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = DEFAULT_BANNER_IMAGE;
                        }}
                      />
                      {formData.rightBadge && (
                        <span className="absolute top-1 right-1 bg-rose-600 text-white font-extrabold text-[8px] px-1.5 py-0.5 rounded shadow uppercase">
                          {formData.rightBadge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left Part Form Section */}
                <div className="space-y-3 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Left Part (Text & Info)
                  </h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Title *</label>
                    <input 
                      type="text" 
                      name="title" 
                      value={formData.title} 
                      onChange={handleInputChange} 
                      required 
                      className="w-full p-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 font-semibold" 
                      placeholder="e.g., Weekend Chef Feast" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Subtitle / Description</label>
                    <textarea 
                      name="subtitle" 
                      value={formData.subtitle} 
                      onChange={handleInputChange} 
                      rows={2}
                      className="w-full p-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                      placeholder="e.g., Handcrafted seasonal specials made fresh" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Badge / Tag</label>
                      <input 
                        type="text" 
                        name="badge" 
                        value={formData.badge} 
                        onChange={handleInputChange} 
                        className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                        placeholder="e.g. CHEF'S SPECIAL" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Button Text</label>
                      <input 
                        type="text" 
                        name="buttonText" 
                        value={formData.buttonText} 
                        onChange={handleInputChange} 
                        className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                        placeholder="e.g. Order Now" 
                      />
                    </div>
                  </div>
                </div>

                {/* Right Part Form Section */}
                <div className="space-y-3 bg-gray-50/70 p-4 rounded-xl border border-gray-200">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Right Part (Visual & Tag)
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Image URL *</label>
                    <input 
                      type="url" 
                      name="imageUrl" 
                      value={formData.imageUrl} 
                      onChange={handleInputChange} 
                      required 
                      className="w-full p-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                      placeholder="https://images.unsplash.com/..." 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Right Badge Tag</label>
                      <input 
                        type="text" 
                        name="rightBadge" 
                        value={formData.rightBadge} 
                        onChange={handleInputChange} 
                        className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                        placeholder="e.g. 20% OFF" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                      <select 
                        name="status" 
                        value={formData.status} 
                        onChange={handleInputChange} 
                        className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 font-bold"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Target Link (Optional)</label>
                    <input 
                      type="text" 
                      name="targetUrl" 
                      value={formData.targetUrl} 
                      onChange={handleInputChange} 
                      className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                      placeholder="Category name (e.g. Biryani) or URL" 
                    />
                  </div>
                </div>

              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isLoading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Banner')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
