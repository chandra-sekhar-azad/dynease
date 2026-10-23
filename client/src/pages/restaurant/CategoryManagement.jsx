import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, X, Loader2, Tag, FolderOpen, Edit2, 
  ToggleLeft, ToggleRight, Search, Table as TableIcon, 
  LayoutGrid, ArrowUpDown, Check, AlertCircle 
} from 'lucide-react';
import { useSocketEvents } from '../../lib/socket';

export default function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  
  // Modal form states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [categoryType, setCategoryType] = useState('all');
  const [categoryDisplayOrder, setCategoryDisplayOrder] = useState(0);
  const [categoryImage, setCategoryImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  
  const [deletingCatId, setDeletingCatId] = useState(null);
  const [quickUpdatingId, setQuickUpdatingId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  
  // View & Filter states
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');

  useEffect(() => {
    fetchCategories();
    fetchMenu();
  }, []);

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

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/categories`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const sorted = (data.data.categories || []).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        setCategories(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/menu`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems(data.data.menuItems);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Realtime: pick up category/menu changes made from other sessions/tabs.
  useSocketEvents({
    menu_updated: () => {
      fetchCategories();
      fetchMenu();
    },
  });

  const openAddModal = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryDesc('');
    setCategoryType('all');
    // Default priority order to next sequential integer
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.displayOrder ?? 0), -1);
    setCategoryDisplayOrder(maxOrder + 1);
    setCategoryImage(null);
    setPreviewImage(null);
    setShowModal(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryDesc(cat.description || '');
    setCategoryType(cat.type || 'all');
    setCategoryDisplayOrder(cat.displayOrder ?? 0);
    setCategoryImage(null);
    setPreviewImage(cat.image?.secure_url || null);
    setShowModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      const formData = new FormData();
      formData.append('name', newCategoryName.trim());
      formData.append('description', newCategoryDesc.trim());
      formData.append('type', categoryType);
      formData.append('displayOrder', categoryDisplayOrder);
      if (categoryImage) {
        formData.append('image', categoryImage);
      }

      const url = editingCategory 
        ? `${import.meta.env.VITE_API_URL}/restaurant/categories/${editingCategory._id}`
        : `${import.meta.env.VITE_API_URL}/restaurant/categories`;
      
      const method = editingCategory ? 'PUT' : 'POST';
      const headers = getHeaders();
      delete headers['Content-Type']; // Let browser set multipart boundary

      const res = await fetch(url, {
        method,
        headers,
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        if (editingCategory) {
          setCategories(prev => {
            const next = prev.map(c => c._id === editingCategory._id ? data.data.category : c);
            return next.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          });
        } else {
          setCategories(prev => {
            const next = [...prev, data.data.category];
            return next.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          });
        }
        setShowModal(false);
      } else {
        alert(data.message || 'Failed to save category');
      }
    } catch (err) {
      alert('Error saving category.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleQuickUpdate = async (catId, updates) => {
    setQuickUpdatingId(catId);
    try {
      const formData = new FormData();
      if (updates.displayOrder !== undefined) formData.append('displayOrder', updates.displayOrder);
      if (updates.type !== undefined) formData.append('type', updates.type);
      if (updates.isActive !== undefined) formData.append('isActive', updates.isActive);

      const reqHeaders = getHeaders();
      delete reqHeaders['Content-Type'];

      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/categories/${catId}`, {
        method: 'PUT',
        headers: reqHeaders,
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => {
          const next = prev.map(c => c._id === catId ? { ...c, ...data.data.category } : c);
          return next.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        });
      } else {
        alert(data.message || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating category:', err);
    } finally {
      setQuickUpdatingId(null);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const itemInUse = menuItems.some(i => i.category === cat.name);
    if (itemInUse) {
       alert(`Cannot delete category "${cat.name}" because it is currently assigned to menu items.`);
       return;
    }

    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;
    setDeletingCatId(cat._id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurant/categories/${cat._id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setCategories(prev => prev.filter(c => c._id !== cat._id));
      } else {
        alert(data.message || 'Error deleting category');
      }
    } catch (err) {
      alert('Error deleting category.');
    } finally {
      setDeletingCatId(null);
    }
  };

  const handleToggleStatus = (cat) => {
    handleQuickUpdate(cat._id, { isActive: !cat.isActive });
  };

  // Filter categories
  const filteredCategories = categories.filter(cat => {
    const matchesSearch = !searchQuery.trim() || 
      cat.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      (cat.description && cat.description.toLowerCase().includes(searchQuery.trim().toLowerCase()));

    const cType = (cat.type || 'all').toLowerCase();
    let matchesType = true;
    if (selectedTypeFilter === 'VEG') matchesType = (cType === 'veg' || cType === 'vegan');
    else if (selectedTypeFilter === 'NON_VEG') matchesType = (cType === 'non-veg');
    else if (selectedTypeFilter === 'ALL_TYPES') matchesType = (cType === 'all');

    return matchesSearch && matchesType;
  });

  const vegCount = categories.filter(c => {
    const t = (c.type || '').toLowerCase();
    return t === 'veg' || t === 'vegan';
  }).length;
  const nonVegCount = categories.filter(c => (c.type || '').toLowerCase() === 'non-veg').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px] relative">
      {/* ── Page Header ── */}
      <div className="p-4 sm:p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50/50 rounded-t-xl">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FolderOpen size={24} className="text-green-600" />
            Category Management
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Set category types (Veg / Non-Veg) and priority order (0, 1, 2, 3...) for your menu
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* View switcher */}
          <div className="flex bg-gray-200 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'table' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <TableIcon size={16} />
              <span className="hidden md:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'grid' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={16} />
              <span className="hidden md:inline">Grid</span>
            </button>
          </div>

          <button 
            onClick={openAddModal} 
            className="flex-1 sm:flex-none justify-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors flex items-center gap-2 shadow-sm shrink-0"
          >
            <Plus size={18} /> Add Category
          </button>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="p-4 border-b border-gray-100 bg-white flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dietary Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-400 font-semibold mr-1 hidden sm:inline">Type:</span>
          {[
            { id: 'ALL', label: `All (${categories.length})` },
            { id: 'VEG', label: `Veg (${vegCount})`, color: 'text-green-700 bg-green-50 border-green-200' },
            { id: 'NON_VEG', label: `Non-Veg (${nonVegCount})`, color: 'text-red-700 bg-red-50 border-red-200' }
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setSelectedTypeFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all ${
                selectedTypeFilter === pill.id
                  ? 'bg-gray-900 text-white border-gray-900 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="animate-spin text-green-500 w-8 h-8" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center p-12 m-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <Tag size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-700">No categories found</h3>
            <p className="text-gray-500 mt-1 text-sm">Get started by creating your first menu category.</p>
            <button 
              onClick={openAddModal} 
              className="mt-4 px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-xs"
            >
              Create Category
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center p-12 text-gray-500 text-sm">
            No categories match your search or filter criteria.
          </div>
        ) : viewMode === 'table' ? (
          /* ── Table View ── */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 text-xs uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-4 w-32">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpDown size={14} className="text-green-600" />
                      Priority
                    </span>
                  </th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 w-44">Type</th>
                  <th className="py-3.5 px-4 w-28 text-center">Items</th>
                  <th className="py-3.5 px-4 w-28 text-center">Status</th>
                  <th className="py-3.5 px-4 w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredCategories.map((cat) => {
                  const count = menuItems.filter(i => i.category === cat.name).length;
                  const isBusy = quickUpdatingId === cat._id;
                  const currentType = (cat.type || 'all').toLowerCase();

                  return (
                    <tr 
                      key={cat._id} 
                      className={`hover:bg-gray-50/70 transition-colors ${!cat.isActive ? 'bg-gray-50/40 opacity-70' : ''}`}
                    >
                      {/* Priority Order Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={cat.displayOrder ?? 0}
                            key={`${cat._id}-${cat.displayOrder}`}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== (cat.displayOrder ?? 0)) {
                                handleQuickUpdate(cat._id, { displayOrder: Math.max(0, val) });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            className="w-16 px-2 py-1 text-center font-bold text-gray-800 bg-gray-50 hover:bg-white focus:bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-xs transition-colors"
                            title="Priority order: 0 is highest priority (appears first on customer menu)"
                          />
                          <span className="text-[11px] text-gray-400 font-semibold select-none">
                            #{cat.displayOrder ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Category Name & Image */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center border border-gray-200 shadow-2xs">
                            {cat.image?.secure_url ? (
                              <img src={cat.image.secure_url} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <Tag size={18} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                              {cat.name}
                            </div>
                            {cat.description ? (
                              <p className="text-xs text-gray-500 max-w-sm truncate mt-0.5">{cat.description}</p>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">No description</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type Column (Veg / Non-Veg / All) */}
                      <td className="py-3.5 px-4">
                        <div className="relative inline-block w-full max-w-[140px]">
                          <select
                            value={currentType === 'vegan' ? 'veg' : currentType}
                            onChange={(e) => handleQuickUpdate(cat._id, { type: e.target.value })}
                            disabled={isBusy}
                            className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer transition-colors ${
                              currentType === 'veg' || currentType === 'vegan'
                                ? 'bg-green-50 text-green-800 border-green-300' 
                                : currentType === 'non-veg'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-gray-50 text-gray-700 border-gray-300'
                            }`}
                          >
                            <option value="veg">🟢 Veg</option>
                            <option value="non-veg">🔴 Non-Veg</option>
                            <option value="all">⚪ All Types</option>
                          </select>
                        </div>
                      </td>

                      {/* Item count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          {count} {count === 1 ? 'item' : 'items'}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(cat)}
                          disabled={isBusy}
                          className={`p-1 rounded-lg transition-colors ${cat.isActive !== false ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          title={cat.isActive !== false ? "Active (Click to disable)" : "Disabled (Click to enable)"}
                        >
                          {cat.isActive !== false ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit Category"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            disabled={deletingCatId === cat._id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Category"
                          >
                            {deletingCatId === cat._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Grid View ── */
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredCategories.map(cat => {
              const count = menuItems.filter(i => i.category === cat.name).length;
              const currentType = (cat.type || 'all').toLowerCase();

              return (
                <div key={cat._id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex shrink-0 items-center justify-center border border-gray-200">
                        {cat.image?.secure_url ? (
                          <img src={cat.image.secure_url} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <Tag size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-gray-800 leading-snug">{cat.name}</h3>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            #{cat.displayOrder ?? 0}
                          </span>
                        </div>
                        <div className="mt-1">
                          {currentType === 'veg' || currentType === 'vegan' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-green-50 text-green-800 border border-green-200 uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Veg
                            </span>
                          ) : currentType === 'non-veg' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-800 border border-red-200 uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> Non-Veg
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] font-medium text-gray-500 px-2 py-0.5 rounded bg-gray-100 uppercase tracking-wider">
                              All types
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit Category"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          disabled={deletingCatId === cat._id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Category"
                        >
                          {deletingCatId === cat._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                      <button
                        onClick={() => handleToggleStatus(cat)}
                        className={`p-1 rounded-lg transition-colors ${cat.isActive !== false ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                        title={cat.isActive !== false ? "Active (Click to disable)" : "Disabled (Click to enable)"}
                      >
                        {cat.isActive !== false ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                      </button>
                    </div>
                  </div>

                  {cat.description && <p className="text-xs text-gray-500 line-clamp-2 mt-2">{cat.description}</p>}
                  
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Priority: {cat.displayOrder ?? 0}</span>
                    <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Category Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/70 shrink-0">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form className="p-4 sm:p-6 space-y-4 overflow-y-auto" onSubmit={handleSaveCategory}>
              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Starters, Veg Curries, Biryanis"
                  required 
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm" 
                />
              </div>

              {/* Priority Order (0, 1, 2, 3...) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Priority Order (0, 1, 2, 3...)
                  </label>
                  <span className="text-[11px] text-green-700 font-semibold">Lower number = appears first</span>
                </div>
                <input 
                  type="number"
                  min="0"
                  step="1"
                  value={categoryDisplayOrder}
                  onChange={e => setCategoryDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  placeholder="0, 1, 2, 3..."
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm font-semibold"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Determines the sort order of this category on customer QR menus and ordering portals.
                </p>
              </div>

              {/* Category Type (Dietary Filter) */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category Type (Dietary Preference)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'All Types', icon: '⚪' },
                    { id: 'veg', label: 'Veg', icon: '🟢', highlight: 'text-green-800 bg-green-50 border-green-500' },
                    { id: 'non-veg', label: 'Non-Veg', icon: '🔴', highlight: 'text-red-800 bg-red-50 border-red-500' }
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setCategoryType(t.id)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center flex items-center justify-center gap-1.5 ${
                        categoryType === t.id
                          ? `ring-2 ring-green-500 ${t.highlight || 'bg-green-50 border-green-500 text-green-800'} shadow-sm`
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Used by customer QR menu to filter purely vegetarian or non-vegetarian categories.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Description <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea 
                  value={newCategoryDesc}
                  onChange={e => setNewCategoryDesc(e.target.value)}
                  placeholder="Short description for the category"
                  rows="2"
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-gray-900 bg-white text-sm" 
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Category Image <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <div 
                  className={`w-full p-3 sm:p-4 border-2 border-dashed rounded-xl flex items-center gap-3 sm:gap-4 transition-colors ${
                    isDragging ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setCategoryImage(file);
                      setPreviewImage(URL.createObjectURL(file));
                    }
                  }}
                >
                  <div className="w-14 h-14 rounded-xl bg-gray-200 overflow-hidden shrink-0 shadow-inner">
                    {previewImage ? (
                      <img src={previewImage} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <FolderOpen size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <input 
                      type="file" 
                      id="categoryImageUpload"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files[0];
                        if (file) {
                          setCategoryImage(file);
                          setPreviewImage(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                    <label htmlFor="categoryImageUpload" className="cursor-pointer">
                      <span className="text-xs sm:text-sm font-semibold text-green-600 hover:text-green-700 underline underline-offset-2">Click to upload</span>
                      <span className="text-xs sm:text-sm text-gray-500"> or drag & drop</span>
                      <p className="text-[10px] text-gray-400 mt-0.5">PNG, JPG or WebP (Max 5MB)</p>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingCategory} 
                  className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-green-600/20 transition-all flex justify-center items-center gap-2"
                >
                  {savingCategory ? <Loader2 size={16} className="animate-spin" /> : null}
                  {savingCategory ? 'Saving...' : (editingCategory ? 'Save Changes' : 'Add Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
