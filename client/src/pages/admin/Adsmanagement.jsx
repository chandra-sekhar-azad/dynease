import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Edit, X, Eye, Sparkles, Image as ImageIcon, ExternalLink, Check, 
  Megaphone, Phone, Mail, Building2, User, MessageSquare, Clock, MapPin, 
  ArrowUpRight, Search, Filter, MessageCircle, AlertCircle
} from 'lucide-react';
import { authFetch } from '../../utils/api';
import { useSocketEvents } from '../../lib/socket';
import { toast, showConfirm } from '../../context/DialogContext';

const DEFAULT_BANNER_IMAGE = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';

export default function AdsManagement() {
  const [activeTab, setActiveTab] = useState('inquiries'); // 'inquiries' | 'banners'
  const [ads, setAds] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [inquiryFilter, setInquiryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states for Banners
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // Reset any previously selected file whenever the modal is (re)opened
  useEffect(() => {
    if (showModal) {
      setImageFile(null);
      setImagePreview('');
    }
  }, [showModal]);

  useEffect(() => {
    fetchAds();
    fetchInquiries();
  }, []);

  const fetchAds = async () => {
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/ads`);
      const data = await res.json();
      if (data.success) setAds(data.data.ads || []);
    } catch (err) {
      console.error('Failed to fetch banners', err);
    }
  };

  const fetchInquiries = async () => {
    let serverInquiries = [];
    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/ad-inquiries`);
      const data = await res.json();
      if (data.success && data.data?.inquiries) {
        serverInquiries = data.data.inquiries;
      }
    } catch (err) {
      console.warn('Backend fetch for inquiries failed, will use local storage if available', err);
    }

    // Read from local storage (hybrid sync for offline/local submissions)
    let localInquiries = [];
    try {
      localInquiries = JSON.parse(localStorage.getItem('dynease_ad_inquiries') || '[]');
    } catch (e) {
      localInquiries = [];
    }

    // Combine uniquely
    const combined = [...serverInquiries];
    localInquiries.forEach(localItem => {
      const exists = combined.some(item => 
        (item._id && localItem._id && item._id === localItem._id) ||
        (item.mobileNumber === localItem.mobileNumber && item.businessName === localItem.businessName)
      );
      if (!exists) {
        combined.push(localItem);
      }
    });

    // Sort by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setInquiries(combined);
  };

  // Realtime: banners changed anywhere + new ad inquiries.
  useSocketEvents({
    banners_updated: () => fetchAds(),
    ad_inquiry: () => fetchInquiries(),
  });

  // Inquiry Status Update
  const handleUpdateInquiryStatus = async (id, newStatus) => {
    // 1. Update in UI state
    const updated = inquiries.map(inq => inq._id === id ? { ...inq, status: newStatus } : inq);
    setInquiries(updated);

    // 2. Update local storage
    try {
      localStorage.setItem('dynease_ad_inquiries', JSON.stringify(updated));
    } catch (e) {}

    // 3. Update server API
    try {
      await authFetch(`${import.meta.env.VITE_API_URL}/admin/ad-inquiries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.warn('API update status error:', err);
    }
  };

  // Delete Inquiry
  const handleDeleteInquiry = async (id) => {
    const ok = await showConfirm({
      title: 'Delete Ad Inquiry',
      message: 'Are you sure you want to delete this advertisement inquiry?',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!ok) return;

    // 1. Update in UI state
    const filtered = inquiries.filter(inq => inq._id !== id);
    setInquiries(filtered);
    toast.success('Inquiry deleted');

    // 2. Update local storage
    try {
      localStorage.setItem('dynease_ad_inquiries', JSON.stringify(filtered));
    } catch (e) {}

    // 3. Update server API
    try {
      await authFetch(`${import.meta.env.VITE_API_URL}/admin/ad-inquiries/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('API delete inquiry error:', err);
    }
  };

  // Convert Inquiry directly into a Menu Banner
  const handleCreateBannerFromInquiry = (inquiry) => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      title: inquiry.businessName,
      subtitle: inquiry.message || `Exclusive deals by ${inquiry.businessName} for diners`,
      badge: 'SPONSORED',
      buttonText: 'View Offer',
      rightBadge: 'PARTNER',
      imageUrl: DEFAULT_BANNER_IMAGE,
      targetUrl: inquiry.email || '',
      status: 'Active'
    });
    setActiveTab('banners');
    setShowModal(true);
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

      // Send multipart/form-data so the image file can be uploaded to Cloudinary
      const body = new FormData();
      body.append('title', formData.title || '');
      body.append('subtitle', formData.subtitle || '');
      body.append('badge', formData.badge || '');
      body.append('buttonText', formData.buttonText || '');
      body.append('rightBadge', formData.rightBadge || '');
      body.append('targetUrl', formData.targetUrl || '');
      body.append('imageUrl', formData.imageUrl || '');
      body.append('status', formData.status || 'Active');
      if (imageFile) body.append('image', imageFile);

      const res = await authFetch(url, {
        method,
        body
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setImageFile(null);
        setImagePreview('');
        fetchAds();
        toast.success(editingAd ? 'Banner updated successfully!' : 'Banner created successfully!');
      } else {
        toast.error(data.message || 'Failed to save banner');
      }
    } catch (err) {
      toast.error('Network error saving banner');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleDelete = async (id) => {
    const ok = await showConfirm({
      title: 'Delete Ad Banner',
      message: 'Are you sure you want to delete this banner? This action cannot be undone.',
      confirmText: 'Delete',
      type: 'danger'
    });
    if (!ok) return;

    try {
      const res = await authFetch(`${import.meta.env.VITE_API_URL}/admin/ads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAds(ads.filter(ad => ad._id !== id));
        toast.success('Banner deleted successfully');
      } else {
        toast.error(data.message || 'Failed to delete banner');
      }
    } catch (err) {
      toast.error('Network error deleting banner');
    }
  };

  // Filtered inquiries
  const filteredInquiries = inquiries.filter(inq => {
    const matchesFilter = inquiryFilter === 'ALL' || inq.status === inquiryFilter;
    const matchesSearch = searchQuery === '' || 
      (inq.name && inq.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inq.mobileNumber && inq.mobileNumber.includes(searchQuery)) ||
      (inq.businessName && inq.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const newInquiriesCount = inquiries.filter(i => i.status === 'NEW').length;

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="text-[var(--color-primary)]" size={26} />
            Banner & Advertising Management
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Review inbound advertising leads from the website and manage promotional banners on customer digital menus.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'banners' ? (
            <button 
              onClick={openAddModal} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus size={18} /> Add New Banner
            </button>
          ) : (
            <button
              onClick={() => {
                setFormData({
                  title: '',
                  subtitle: '',
                  badge: 'SPONSORED',
                  buttonText: 'Explore',
                  rightBadge: 'FEATURED',
                  imageUrl: DEFAULT_BANNER_IMAGE,
                  targetUrl: '',
                  status: 'Active'
                });
                setActiveTab('banners');
                setShowModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus size={18} /> Create Banner
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'inquiries'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Megaphone size={18} />
          <span>Advertiser Inquiries ({inquiries.length})</span>
          {newInquiriesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {newInquiriesCount} NEW
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('banners')}
          className={`pb-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'banners'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ImageIcon size={18} />
          <span>Customer Menu Banners ({ads.length})</span>
        </button>
      </div>

      {/* TAB 1: ADVERTISER INQUIRIES */}
      {activeTab === 'inquiries' && (
        <div className="space-y-4">
          
          {/* Filters & Search Toolbar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, mobile, business..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-xs text-gray-400 font-medium mr-1 flex items-center gap-1">
                <Filter size={12} /> Filter:
              </span>
              {[
                { label: 'All', value: 'ALL', count: inquiries.length },
                { label: 'New', value: 'NEW', count: inquiries.filter(i => i.status === 'NEW').length },
                { label: 'Contacted', value: 'CONTACTED', count: inquiries.filter(i => i.status === 'CONTACTED').length },
                { label: 'Approved', value: 'APPROVED', count: inquiries.filter(i => i.status === 'APPROVED').length },
                { label: 'Rejected', value: 'REJECTED', count: inquiries.filter(i => i.status === 'REJECTED').length },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setInquiryFilter(f.value)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    inquiryFilter === f.value
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

          </div>

          {/* Inquiries List */}
          {filteredInquiries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-xs">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                <Megaphone size={30} />
              </div>
              <h3 className="text-lg font-bold text-gray-800">No Inquiries Found</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                {searchQuery || inquiryFilter !== 'ALL' 
                  ? 'No advertisement inquiries match your current filter or search criteria.' 
                  : 'When visitors fill out the "Advertise Here" form on the website, their details (Name, Mobile, Business) will appear here instantly.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInquiries.map((inquiry) => {
                const cleanPhone = (inquiry.mobileNumber || '').replace(/\D/g, '');
                const formattedDate = inquiry.createdAt 
                  ? new Date(inquiry.createdAt).toLocaleString('en-IN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })
                  : 'Recently';

                return (
                  <div 
                    key={inquiry._id} 
                    className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                      inquiry.status === 'NEW' 
                        ? 'border-amber-300 ring-1 ring-amber-200/50 bg-amber-50/10' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div>
                      {/* Top Row: Business Name & Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <Building2 size={18} />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-gray-900 leading-snug line-clamp-1">
                              {inquiry.businessName}
                            </h3>
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <Clock size={11} /> {formattedDate}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge Dropdown */}
                        <select
                          value={inquiry.status || 'NEW'}
                          onChange={(e) => handleUpdateInquiryStatus(inquiry._id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-full border cursor-pointer outline-none transition-colors ${
                            inquiry.status === 'NEW'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : inquiry.status === 'CONTACTED'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : inquiry.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                        >
                          <option value="NEW">NEW</option>
                          <option value="CONTACTED">CONTACTED</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="REJECTED">REJECTED</option>
                        </select>
                      </div>

                      {/* Contact Details Card */}
                      <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 border border-gray-100 mb-3 text-xs">
                        
                        {/* 1. Name */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <User size={14} className="text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-500">Contact:</span>
                          <strong className="text-gray-900">{inquiry.name}</strong>
                        </div>

                        {/* 2. Mobile Number */}
                        <div className="flex items-center gap-2 text-gray-700">
                          <Phone size={14} className="text-emerald-600 shrink-0" />
                          <span className="font-medium text-gray-500">Mobile:</span>
                          <a 
                            href={`tel:${inquiry.mobileNumber}`} 
                            className="font-bold text-emerald-700 hover:underline"
                          >
                            {inquiry.mobileNumber}
                          </a>
                        </div>

                        {/* Optional Email */}
                        {inquiry.email && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <Mail size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-500">Email:</span>
                            <a href={`mailto:${inquiry.email}`} className="text-gray-800 hover:underline truncate">
                              {inquiry.email}
                            </a>
                          </div>
                        )}

                        {/* Optional City */}
                        {inquiry.city && (
                          <div className="flex items-center gap-2 text-gray-700">
                            <MapPin size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-500">City:</span>
                            <span className="text-gray-800">{inquiry.city}</span>
                          </div>
                        )}

                        {/* Optional Message */}
                        {inquiry.message && (
                          <div className="pt-1 border-t border-gray-200 mt-1">
                            <p className="text-[11px] text-gray-600 italic">
                              "{inquiry.message}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                      
                      {/* WhatsApp Button */}
                      <a
                        href={`https://wa.me/91${cleanPhone.slice(-10)}?text=${encodeURIComponent(
                          `Hello ${inquiry.name}, thank you for your advertising inquiry with Dynease regarding ${inquiry.businessName}!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <MessageCircle size={14} className="text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Convert to Banner */}
                      <button
                        onClick={() => handleCreateBannerFromInquiry(inquiry)}
                        className="py-1.5 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Create Menu Banner for this advertiser"
                      >
                        <Sparkles size={13} className="text-amber-500" />
                        <span>Banner</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteInquiry(inquiry._id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Inquiry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: MENU BANNERS */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
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
                  className="mt-5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
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
                              e.target.src = DEFAULT_BANNER_IMAGE;
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit size={16} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(ad._id)} 
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg font-medium text-xs flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal for Add / Edit Banner */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-lg font-bold text-gray-800">
                {isEditing ? 'Edit Two-Part Banner' : 'Create New Two-Part Banner'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
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
                        src={imagePreview || formData.imageUrl || DEFAULT_BANNER_IMAGE} 
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
                    <label className="block text-xs font-bold text-gray-700 mb-1">Banner Image</label>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold border border-dashed border-emerald-400 rounded-lg bg-emerald-50/50 text-emerald-700 cursor-pointer hover:bg-emerald-50 transition-colors">
                        <ImageIcon size={15} />
                        <span>{imageFile ? imageFile.name : 'Upload image (stored on Cloudinary)'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                      {(imageFile || imagePreview) && (
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(''); }}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Remove selected image"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    {imagePreview && (
                      <div className="mt-2 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <img src={imagePreview} alt="Selected preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Or paste Image URL</label>
                    <input 
                      type="url" 
                      name="imageUrl" 
                      value={formData.imageUrl} 
                      onChange={handleInputChange} 
                      className="w-full p-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500" 
                      placeholder="https://images.unsplash.com/..." 
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Used only when no file is uploaded.</p>
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
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
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
