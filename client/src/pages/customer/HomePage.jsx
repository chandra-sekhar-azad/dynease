import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Loader2, Plus, Minus, X, Menu as MenuIcon, ArrowLeft, Bell } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useRestaurant, getTenantHeaders } from '../../context/RestaurantContext';
import CustomerSidebar from '../../components/customer/CustomerSidebar';
import ServiceRequestModal from '../../components/customer/ServiceRequestModal';

const SIZE_FILTERS = [
  { id: 'ALL', label: 'All Sizes' },
  { id: 'HALF', label: 'Half', keywords: ['half'] },
  { id: 'FULL', label: 'Full', keywords: ['full'] },
  { id: 'SMALL', label: 'Small', keywords: ['small'] },
  { id: 'MEDIUM', label: 'Medium', keywords: ['medium', 'meduim'] },
  { id: 'LARGE', label: 'Large', keywords: ['large'] },
  { id: 'JUMBO', label: 'Jumbo', keywords: ['jumbo'] }
];

export default function HomePage({ forcedSlug }) {
  const { slug: paramSlug } = useParams();
  const activeSlug = forcedSlug || paramSlug;
  const { session, addToCart, removeFromCart, updateQuantity, cart, cartCount } = useRestaurant();
  
  const [restaurant, setRestaurant] = useState(session?.restaurant || null);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeDiet, setActiveDiet] = useState('ALL');
  const [activeSize, setActiveSize] = useState('ALL');
  const [sizeSelectModalItem, setSizeSelectModalItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const categoryRefs = useRef({});
  const searchInputRef = useRef(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '';
        let fetchedAds = [];

        // 1. Fetch from /admin/ads (primary production endpoint where admin manages ads)
        try {
          const res = await fetch(`${apiUrl}/admin/ads`);
          const json = await res.json();
          if (json.success && Array.isArray(json.data?.ads) && json.data.ads.length > 0) {
            fetchedAds = json.data.ads;
          }
        } catch (e) {
          console.warn('Could not fetch from /admin/ads, trying public endpoint', e);
        }

        // 2. Fallback to /public/banners or /public/ads
        if (fetchedAds.length === 0) {
          try {
            const res = await fetch(`${apiUrl}/public/banners`);
            const json = await res.json();
            if (json.success) {
              fetchedAds = json.data?.banners || json.data?.ads || [];
            }
          } catch (e) {
            console.warn('Could not fetch from /public/banners', e);
          }
        }

        // Filter active banners (case-insensitive)
        const activeOnly = fetchedAds.filter(ad => 
          !ad.status || String(ad.status).toLowerCase() === 'active'
        );

        if (activeOnly.length > 0) {
          setBanners(activeOnly);
        }
      } catch (err) {
        console.error('Failed to fetch banners', err);
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        let url;
        const headers = getTenantHeaders();

        if (activeSlug) {
          url = `${import.meta.env.VITE_API_URL}/public/restaurant/${activeSlug}/menu`;
        } else {
          url = `${import.meta.env.VITE_API_URL}/public/menu`;
        }

        const res = await fetch(url, { headers });
        const json = await res.json();
        
        if (json.success) {
          const data = json.data;
          setRestaurant(data.restaurant || session?.restaurant);
          if (data.categories && Array.isArray(data.categories) && data.categories[0]?.items) {
            setCategories(data.categories);
            setActiveCategory(data.categories[0]?.name || null);
          } else if (data.menuItems) {
            const grouped = {};
            for (const item of data.menuItems) {
              if (!grouped[item.category]) grouped[item.category] = [];
              grouped[item.category].push({
                id: item._id,
                name: item.name,
                description: item.description,
                price: item.price,
                imageUrl: item.image?.secure_url || null,
                isAvailable: item.isAvailable,
                dietaryPreference: item.dietaryPreference,
                quantities: item.quantities || []
              });
            }
            const cats = Object.entries(grouped).map(([name, items]) => ({ name, items }));
            setCategories(cats);
            setActiveCategory(cats[0]?.name || null);
          }
        } else {
          setError(json.message || 'Failed to load menu.');
          setErrorCode(json.code || '');
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [activeSlug]);

  const getItemVariantForActiveSize = (item, sizeFilterId) => {
    if (!sizeFilterId || sizeFilterId === 'ALL' || !Array.isArray(item.quantities) || item.quantities.length === 0) {
      return null;
    }
    const filter = SIZE_FILTERS.find(f => f.id === sizeFilterId);
    if (!filter || !filter.keywords) return null;
    return item.quantities.find(q => {
      if (!q || !q.size) return false;
      const s = q.size.trim().toLowerCase();
      return filter.keywords.some(kw => s.includes(kw));
    }) || null;
  };

  const getItemQty = (id, size = null) => {
    if (size) {
      return cart.find(i => i.menuItemId === String(id) && (i.size || '').toLowerCase() === size.toLowerCase())?.quantity || 0;
    }
    return cart.filter(i => i.menuItemId === String(id)).reduce((sum, i) => sum + i.quantity, 0);
  };

  const handleAdd = (item, chosenSize = null, chosenPrice = null) => {
    if (chosenSize) {
      addToCart({
        menuItemId: String(item.id),
        name: item.name,
        price: chosenPrice !== null ? chosenPrice : item.price,
        imageUrl: item.imageUrl,
        dietaryPreference: item.dietaryPreference,
        size: chosenSize
      });
      return;
    }

    if (activeSize !== 'ALL') {
      const variant = getItemVariantForActiveSize(item, activeSize);
      if (variant) {
        addToCart({
          menuItemId: String(item.id),
          name: item.name,
          price: variant.price,
          imageUrl: item.imageUrl,
          dietaryPreference: item.dietaryPreference,
          size: variant.size
        });
        return;
      }
    }

    if (Array.isArray(item.quantities) && item.quantities.length > 0) {
      setSizeSelectModalItem(item);
      return;
    }

    addToCart({
      menuItemId: String(item.id),
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      dietaryPreference: item.dietaryPreference,
      size: null
    });
  };

  const isCategoryMatchingDiet = (cat, diet) => {
    if (!diet || diet === 'ALL') return true;
    const cType = (cat.type || '').toLowerCase();
    const cName = (cat.name || '').toLowerCase();

    if (diet === 'VEG') {
      if (cType === 'veg') return true;
      if (cType === 'non-veg' || cType === 'non-vegan') return false;
      if (cType === 'vegan') return true;
      if (cName.includes('non-veg') || cName.includes('non veg') || cName.includes('nonveg')) return false;
      if (cName.includes('veg')) return true;
      return (cat.items || []).some(i => i.dietaryPreference === 'VEG' || i.dietaryPreference === 'VEGAN') &&
             !(cat.items || []).some(i => i.dietaryPreference === 'NON_VEG');
    }

    if (diet === 'NON_VEG') {
      if (cType === 'non-veg') return true;
      if (cType === 'veg' || cType === 'vegan') return false;
      if (cName.includes('non-veg') || cName.includes('non veg') || cName.includes('nonveg')) return true;
      return (cat.items || []).some(i => i.dietaryPreference === 'NON_VEG');
    }

    if (diet === 'VEGAN') {
      if (cType === 'vegan') return true;
      if (cType === 'non-veg' || cType === 'non-vegan') return false;
      if (cName.includes('vegan')) return true;
      return (cat.items || []).some(i => i.dietaryPreference === 'VEGAN');
    }

    if (diet === 'NON_VEGAN') {
      if (cType === 'non-vegan') return true;
      if (cType === 'vegan') return false;
      if (cName.includes('non-vegan') || cName.includes('non vegan')) return true;
      return (cat.items || []).some(i => i.dietaryPreference !== 'VEGAN');
    }

    return true;
  };

  const itemMatchesDiet = (pref, diet) => {
    if (!diet || diet === 'ALL') return true;
    if (diet === 'VEG') return pref === 'VEG' || pref === 'VEGAN';
    if (diet === 'NON_VEG') return pref === 'NON_VEG';
    if (diet === 'VEGAN') return pref === 'VEGAN';
    if (diet === 'NON_VEGAN') return pref !== 'VEGAN';
    return true;
  };

  const itemMatchesSize = (item, sizeFilterId) => {
    if (!sizeFilterId || sizeFilterId === 'ALL') return true;
    const filter = SIZE_FILTERS.find(f => f.id === sizeFilterId);
    if (!filter || !filter.keywords) return true;

    if (Array.isArray(item.quantities) && item.quantities.length > 0) {
      const hasSize = item.quantities.some(q => {
        if (!q || !q.size) return false;
        const s = q.size.trim().toLowerCase();
        return filter.keywords.some(kw => s.includes(kw));
      });
      if (hasSize) return true;
    }

    const nameLower = (item.name || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    return filter.keywords.some(kw => nameLower.includes(kw) || descLower.includes(kw));
  };

  const isCategoryMatchingDietAndSize = (cat, diet, sizeId) => {
    const dietMatches = isCategoryMatchingDiet(cat, diet);
    if (!dietMatches) return false;
    if (!sizeId || sizeId === 'ALL') return true;
    return (cat.items || []).some(item => 
      itemMatchesDiet(item.dietaryPreference, diet) && itemMatchesSize(item, sizeId)
    );
  };

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: (cat.items || []).filter(item => {
      const matchesSearch = !search || 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesDiet = itemMatchesDiet(item.dietaryPreference, activeDiet);
      const matchesSize = itemMatchesSize(item, activeSize);
      return matchesSearch && matchesDiet && matchesSize;
    })
  })).filter(cat => cat.items.length > 0);

  const matchingSearchItems = search.trim() ? categories.flatMap(cat => 
    (cat.items || []).filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(search.toLowerCase()) || 
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesDiet = itemMatchesDiet(item.dietaryPreference, activeDiet);
      const matchesSize = itemMatchesSize(item, activeSize);
      return matchesSearch && matchesDiet && matchesSize;
    }).map(item => ({ ...item, categoryName: cat.name }))
  ) : [];

  const sizeFilteredDishes = activeSize !== 'ALL' ? categories.flatMap(cat =>
    (cat.items || []).filter(item => {
      const matchesDiet = itemMatchesDiet(item.dietaryPreference, activeDiet);
      const matchesSize = itemMatchesSize(item, activeSize);
      return matchesDiet && matchesSize;
    }).map(item => ({ ...item, categoryName: cat.name }))
  ) : [];

  const scrollToCategory = (name) => {
    setActiveCategory(name);
    categoryRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-[var(--color-primary)] w-8 h-8 mx-auto mb-4" />
          <p className="text-[var(--color-text-muted)] font-serif italic">Curating the menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isSubscriptionError = errorCode.startsWith('SUBSCRIPTION_');
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[var(--radius-sm)] shadow-sm border border-[var(--color-border)] p-8 max-w-sm w-full">
          <h2 className="text-xl font-serif text-[var(--color-text)] mb-3">
            {isSubscriptionError ? 'Service Unavailable' : 'Notice'}
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6 font-light">{error}</p>
          {!isSubscriptionError && (
            <button onClick={() => window.location.reload()} className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-[var(--radius-sm)] text-sm uppercase tracking-wider font-medium">Retry</button>
          )}
        </div>
      </div>
    );
  }

  const renderSizeFilterButtons = () => (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
      {SIZE_FILTERS.map(btn => {
        const isActive = activeSize === btn.id;
        return (
          <button
            key={btn.id}
            type="button"
            onClick={() => setActiveSize(btn.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
              isActive
                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <span>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderDishItem = (item, categoryName = null) => {
    const variant = getItemVariantForActiveSize(item, activeSize);
    const displayPrice = variant ? variant.price : item.price;
    const displaySizeLabel = variant ? variant.size : null;
    const itemQty = variant ? getItemQty(item.id, variant.size) : getItemQty(item.id);

    return (
      <div key={`${item.id}_${displaySizeLabel || 'default'}`} className="bg-white border border-[var(--color-border)] rounded-xl flex gap-3 p-3 items-center shadow-xs">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-50 border border-gray-100 relative">
          <img
            src={item.imageUrl || `https://placehold.co/96x96/f5f5f4/1c1917?text=${encodeURIComponent(item.name[0])}`}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h4 className="font-serif font-bold text-sm text-[var(--color-text)] truncate">{item.name}</h4>
            {item.dietaryPreference && (
              <span className={`w-2 h-2 rounded-full shrink-0 ${item.dietaryPreference === 'VEG' || item.dietaryPreference === 'VEGAN' ? 'bg-green-600' : 'bg-red-600'}`} />
            )}
          </div>
          {categoryName && (
            <div className="text-[11px] text-gray-500 font-medium truncate mb-1">
              {categoryName}
            </div>
          )}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <p className="text-xs font-bold text-[var(--color-text)]">₹{displayPrice}</p>
            {displaySizeLabel ? (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                {displaySizeLabel}
              </span>
            ) : (activeSize === 'ALL' && item.quantities && item.quantities.length > 0 && (
              <span className="text-[10px] text-gray-400 font-medium">
                ({item.quantities.length} sizes)
              </span>
            ))}
          </div>

          {/* Quick clickable size chips when on ALL view */}
          {activeSize === 'ALL' && item.quantities && item.quantities.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.quantities.map((q, qIdx) => {
                const qQty = getItemQty(item.id, q.size);
                return (
                  <button
                    key={qIdx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdd(item, q.size, q.price);
                    }}
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-all active:scale-95 cursor-pointer ${
                      qQty > 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border-gray-200'
                    }`}
                    title={`Add ${q.size} (₹${q.price})`}
                  >
                    {q.size}: ₹{q.price} {qQty > 0 ? `(${qQty})` : '+'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="shrink-0">
          {itemQty === 0 ? (
            <button
              onClick={() => handleAdd(item, variant?.size, variant?.price)}
              className="flex items-center gap-1 bg-white border border-emerald-700 text-emerald-800 font-bold px-3 py-1 rounded-lg text-xs hover:bg-emerald-700 hover:text-white transition-colors shadow-xs cursor-pointer"
            >
              <Plus size={12} /> Add
            </button>
          ) : (
            <div className="flex items-center gap-2 border border-emerald-700 bg-emerald-50/50 rounded-lg text-emerald-800 px-1 py-0.5">
              <button
                onClick={() => updateQuantity(String(item.id), itemQty - 1, variant?.size)}
                className="p-1 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
              >
                <Minus size={11} />
              </button>
              <span className="font-bold text-xs w-3 text-center">{itemQty}</span>
              <button
                onClick={() => updateQuantity(String(item.id), itemQty + 1, variant?.size)}
                className="p-1 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
              >
                <Plus size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const tableLabel = session?.table?.tableNumber ? `Table ${session.table.tableNumber}` : null;

  return (
    <div className="min-h-screen bg-[var(--color-background)] max-w-md mx-auto relative shadow-2xl pb-28">
      {/* ── Header ── */}
      <header className="bg-white px-3 sm:px-4 py-3 sticky top-0 z-20 border-b border-[var(--color-border)] shadow-xs">
        <div className="flex justify-between items-center gap-2 min-h-[36px]">
          {isSearchOpen ? (
            <div className="flex items-center gap-2 w-full animate-in fade-in duration-150">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                      setSearch('');
                    }
                  }}
                  placeholder="Search dishes, drinks..."
                  className="w-full bg-gray-50 focus:bg-white border border-gray-200 focus:border-green-600 rounded-full pl-9 pr-8 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-600 transition-all font-medium"
                />
                {search && (
                  <button 
                    type="button"
                    onClick={() => {
                      setSearch('');
                      searchInputRef.current?.focus();
                    }} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full cursor-pointer"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearch('');
                }}
                className="px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {selectedCategory ? (
                  <button 
                    onClick={() => setSelectedCategory(null)} 
                    className="p-1.5 -ml-1 hover:bg-[var(--color-background)] rounded-[var(--radius-sm)] transition-colors shrink-0 cursor-pointer"
                  >
                    <ArrowLeft size={20} className="text-[var(--color-text)]" />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsSidebarOpen(true)} 
                    className="p-1.5 -ml-1 hover:bg-[var(--color-background)] rounded-[var(--radius-sm)] transition-colors shrink-0 cursor-pointer"
                  >
                    <MenuIcon size={20} className="text-[var(--color-text)]" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col">
                    <h1 className="text-sm sm:text-base font-serif font-bold text-[var(--color-text)] leading-tight tracking-wide truncate">
                      {selectedCategory || restaurant?.name || 'Menu'}
                    </h1>
                    {!selectedCategory && restaurant?.subtitle && (
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-widest truncate mt-0.5">
                        {restaurant.subtitle}
                      </span>
                    )}
                  </div>
                  {tableLabel && !selectedCategory && (
                    <span className="text-[9px] bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold px-1.5 py-0.5 mt-0.5 inline-block uppercase tracking-wider rounded-xs">
                      {tableLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Search icon button */}
              <button
                type="button"
                id="search-toggle-btn"
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="p-2 text-gray-600 hover:text-green-700 hover:bg-gray-100 rounded-full transition-colors shrink-0 cursor-pointer"
                title="Search dishes"
                aria-label="Search dishes"
              >
                <Search size={18} />
              </button>
            </>
          )}
        </div>
      </header>

      {!selectedCategory ? (
        <div className="bg-[var(--color-background)] pb-6">
          {/* Two-Part Promotional Banner */}
          {(() => {
            const activeBanner = banners.length > 0 ? banners[currentBannerIndex] : {
              title: "Chef's Signature Specials",
              subtitle: "Handcrafted delicacies prepared fresh daily with authentic ingredients.",
              badge: "CHEF'S SPECIAL",
              buttonText: "Explore Now",
              rightBadge: "FRESH TODAY",
              imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
              targetUrl: ""
            };

            const handleBannerClick = () => {
              if (activeBanner.targetUrl) {
                if (activeBanner.targetUrl.startsWith('http')) {
                  window.open(activeBanner.targetUrl, '_blank');
                } else if (categories.some(c => c.name.toLowerCase() === activeBanner.targetUrl.toLowerCase())) {
                  setSelectedCategory(activeBanner.targetUrl);
                }
              }
            };

            return (
              <div className="px-4 pt-3 pb-1">
                <div 
                  onClick={handleBannerClick}
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-950 text-white shadow-md border border-emerald-700/50 transition-all ${activeBanner.targetUrl ? 'cursor-pointer hover:shadow-lg' : ''}`}
                >
                  <div className="grid grid-cols-12 items-stretch min-h-[135px]">
                    <div className="col-span-7 sm:col-span-8 p-4 sm:p-5 flex flex-col justify-between">
                      <div>
                        {activeBanner.badge && (
                          <span className="inline-block text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full mb-1.5 shadow-sm">
                            {activeBanner.badge}
                          </span>
                        )}
                        <h2 className="font-serif font-bold text-sm sm:text-lg text-white leading-tight line-clamp-2">
                          {activeBanner.title}
                        </h2>
                        {activeBanner.subtitle && (
                          <p className="text-[11px] sm:text-xs text-emerald-100/90 mt-1 line-clamp-2 font-light leading-snug">
                            {activeBanner.subtitle}
                          </p>
                        )}
                      </div>

                      {activeBanner.buttonText && (
                        <div className="mt-2.5">
                          <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold bg-white/95 hover:bg-white text-emerald-950 px-2.5 py-1 rounded-md shadow-sm transition-transform active:scale-95">
                            {activeBanner.buttonText} →
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="col-span-5 sm:col-span-4 relative overflow-hidden flex items-center justify-center p-2.5">
                      <div className="w-full h-full min-h-[110px] rounded-xl overflow-hidden relative shadow-inner bg-black/25">
                        <img 
                          src={activeBanner.imageUrl} 
                          alt={activeBanner.title}
                          className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';
                          }}
                        />
                        {activeBanner.rightBadge && (
                          <span className="absolute top-1.5 right-1.5 bg-rose-600 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded shadow uppercase tracking-wider">
                            {activeBanner.rightBadge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {banners.length > 1 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      {banners.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentBannerIndex(idx);
                          }}
                          className={`h-1.5 rounded-full transition-all ${
                            idx === currentBannerIndex ? 'bg-amber-400 w-3.5' : 'bg-white/50 w-1.5 hover:bg-white'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Dietary Buttons */}
          <div className="px-4 pt-3 pb-1">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'VEG', label: 'Veg', dot: 'bg-green-600' },
                { id: 'NON_VEG', label: 'Non-Veg', dot: 'bg-red-600' },
                { id: 'VEGAN', label: 'Vegan', dot: 'bg-emerald-600' },
                { id: 'NON_VEGAN', label: 'Non-Vegan', dot: 'bg-orange-600' }
              ].map(dietBtn => {
                const isActive = activeDiet === dietBtn.id;
                return (
                  <button
                    key={dietBtn.id}
                    onClick={() => setActiveDiet(dietBtn.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                      isActive
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {dietBtn.dot && (
                      <span className={`w-2 h-2 rounded-full ${dietBtn.dot} shrink-0`} />
                    )}
                    <span>{dietBtn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Filter Buttons (Half, Full, Small, Medium, Large, Jumbo) */}
          <div className="px-4 pb-2">
            {renderSizeFilterButtons()}
          </div>

          {/* Search Results */}
          {search.trim() ? (
            <div className="px-4 pt-2 pb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-serif font-bold text-sm text-[var(--color-text)]">
                  Dishes matching "{search}" ({matchingSearchItems.length})
                </h3>
                <button 
                  onClick={() => setSearch('')} 
                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>

              {matchingSearchItems.length > 0 ? (
                <div className="space-y-3">
                  {matchingSearchItems.map(item => renderDishItem(item, item.categoryName))}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 p-6">
                  <Search size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="font-serif font-bold text-sm text-gray-700">No dishes match "{search}"</p>
                  <p className="text-xs text-gray-400 mt-1">Try another keyword or select another size/diet filter</p>
                </div>
              )}
            </div>
          ) : activeSize !== 'ALL' ? (
            /* Dishes Filtered By Size on Home View */
            <div className="px-4 pt-2 pb-6">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="font-serif font-bold text-sm text-[var(--color-text)]">
                    Dishes available in {SIZE_FILTERS.find(f => f.id === activeSize)?.label} ({sizeFilteredDishes.length})
                  </h3>
                  <p className="text-[11px] text-gray-500">Filtered by {SIZE_FILTERS.find(f => f.id === activeSize)?.label} size</p>
                </div>
                <button 
                  onClick={() => setActiveSize('ALL')} 
                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                >
                  All sizes
                </button>
              </div>

              {sizeFilteredDishes.length > 0 ? (
                <div className="space-y-3">
                  {sizeFilteredDishes.map(item => renderDishItem(item, item.categoryName))}
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 p-6">
                  <p className="font-serif font-bold text-sm text-gray-700">No dishes available in {SIZE_FILTERS.find(f => f.id === activeSize)?.label}</p>
                  <p className="text-xs text-gray-400 mt-1">Try selecting another size filter or view all sizes</p>
                  <button onClick={() => setActiveSize('ALL')} className="mt-3 text-xs text-emerald-700 font-bold hover:underline cursor-pointer">
                    Show all sizes
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Categories Grid */
            <div className="p-4 grid grid-cols-2 gap-4 mt-1">
              {categories.filter(cat => isCategoryMatchingDietAndSize(cat, activeDiet, activeSize)).map(cat => {
                const catImage = cat.image || cat.items.find(i => i.imageUrl)?.imageUrl;
                return (
                  <div 
                    key={cat.name} 
                    onClick={() => setSelectedCategory(cat.name)}
                    className="bg-white rounded-[var(--radius-sm)] border border-[var(--color-border)] p-2 flex flex-col items-center text-center cursor-pointer hover:border-[var(--color-primary-light)] transition-colors group shadow-xs hover:shadow-sm"
                  >
                    <div className="w-full aspect-[4/3] bg-[var(--color-background)] rounded-[var(--radius-sm)] mb-3 overflow-hidden border border-[var(--color-border)]">
                      {catImage ? (
                        <img src={catImage} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                          <span className="font-serif text-2xl opacity-50">{cat.name[0]}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-serif font-semibold text-[var(--color-text)] text-sm leading-tight mb-1 pb-1 tracking-wide">{cat.name}</h3>
                    {cat.type && cat.type !== 'all' && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider mb-1 ${
                        cat.type === 'veg' ? 'bg-green-50 text-green-700' :
                        cat.type === 'non-veg' ? 'bg-red-50 text-red-700' :
                        cat.type === 'vegan' ? 'bg-emerald-50 text-emerald-700' :
                        'bg-orange-50 text-orange-700'
                      }`}>
                        {cat.type}
                      </span>
                    )}
                  </div>
                );
              })}
              {categories.filter(cat => isCategoryMatchingDietAndSize(cat, activeDiet, activeSize)).length === 0 && (
                <div className="col-span-2 text-center py-10 bg-white rounded-xl border border-dashed border-gray-300 p-6">
                  <p className="font-serif font-bold text-sm text-gray-700">No categories found</p>
                  <p className="text-xs text-gray-400 mt-1">No categories match the selected filter</p>
                  <button onClick={() => { setActiveDiet('ALL'); setActiveSize('ALL'); }} className="mt-3 text-xs text-emerald-700 font-bold hover:underline cursor-pointer">
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-background)] pb-6">
          {/* Filters in category view */}
          <div className="bg-white px-4 py-2.5 sticky top-[57px] z-10 border-b border-[var(--color-border)] space-y-1.5">
            {/* Dietary buttons */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-0.5">
              {[
                { value: 'ALL', label: 'All' },
                { value: 'VEG', label: 'Veg' },
                { value: 'NON_VEG', label: 'Non-Veg' },
                { value: 'VEGAN', label: 'Vegan' },
                { value: 'NON_VEGAN', label: 'Non-Vegan' }
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setActiveDiet(type.value)}
                  className={`whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full transition-colors flex-shrink-0 border cursor-pointer ${
                    activeDiet === type.value
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Size filter buttons */}
            {renderSizeFilterButtons()}
          </div>

          {/* Items List */}
          <div className="px-4 pt-4 space-y-3">
            {filteredCategories
              .filter(cat => cat.name === selectedCategory)
              .map(cat => cat.items.map(item => renderDishItem(item)))}
            
            {filteredCategories.filter(cat => cat.name === selectedCategory).length === 0 && (
              <div className="text-center py-16 text-[var(--color-text-muted)] border border-[var(--color-border)] bg-white rounded-xl">
                <p className="font-serif text-lg mb-1">No items found</p>
                <p className="text-sm font-light">Try adjusting your dietary or size filters</p>
                <button
                  onClick={() => { setActiveDiet('ALL'); setActiveSize('ALL'); }}
                  className="mt-3 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Size Selection Modal ── */}
      {sizeSelectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="font-serif font-bold text-base text-gray-900 leading-tight">
                  {sizeSelectModalItem.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select your preferred portion / size</p>
              </div>
              <button
                onClick={() => setSizeSelectModalItem(null)}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5">
              {sizeSelectModalItem.quantities?.map((qtyItem, qIdx) => {
                const qtyInCart = getItemQty(sizeSelectModalItem.id, qtyItem.size);
                return (
                  <div
                    key={qIdx}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all bg-white"
                  >
                    <div>
                      <span className="font-bold text-sm text-gray-900 block">{qtyItem.size}</span>
                      <span className="text-xs font-semibold text-emerald-700">₹{qtyItem.price}</span>
                    </div>
                    <div>
                      {qtyInCart === 0 ? (
                        <button
                          onClick={() => handleAdd(sizeSelectModalItem, qtyItem.size, qtyItem.price)}
                          className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus size={12} /> Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 border border-emerald-700 bg-emerald-50 rounded-lg text-emerald-800 px-1 py-0.5">
                          <button
                            onClick={() => updateQuantity(String(sizeSelectModalItem.id), qtyInCart - 1, qtyItem.size)}
                            className="p-1 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="font-bold text-xs w-4 text-center">{qtyInCart}</span>
                          <button
                            onClick={() => updateQuantity(String(sizeSelectModalItem.id), qtyInCart + 1, qtyItem.size)}
                            className="p-1 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSizeSelectModalItem(null)}
                className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Action Buttons (Cart & Call Waiter) ── */}
      <div className="fixed bottom-6 left-0 right-0 z-50 pointer-events-none px-4 flex justify-between">
        <div className="w-full max-w-md mx-auto flex items-center justify-between">
          {session?.table && (
            <button
              onClick={() => setIsServiceModalOpen(true)}
              aria-label="Call Waiter"
              className="pointer-events-auto flex items-center gap-2 px-3.5 py-3 bg-white/95 backdrop-blur-md border border-emerald-600/30 text-emerald-800 shadow-xl rounded-full text-xs font-bold hover:bg-emerald-50 transition-all hover:scale-105 active:scale-95"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
              </span>
              <Bell size={16} className="text-emerald-600" />
              <span>Call Waiter</span>
            </button>
          )}

          <div className="ml-auto">
            <Link
              to="/cart"
              aria-label="View cart"
              className="pointer-events-auto relative p-4 bg-[var(--color-primary)] text-white shadow-lg hover:bg-[var(--color-primary-light)] transition-colors flex items-center justify-center rounded-none"
            >
              <ShoppingBag size={22} className="text-white" />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 -mt-2 -mr-2 w-6 h-6 bg-[var(--color-accent)] text-white text-xs flex items-center justify-center font-medium border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      <CustomerSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        tableLabel={tableLabel} 
        googleReviewLink={restaurant?.googleReviewLink}
        onOpenServiceRequest={() => setIsServiceModalOpen(true)}
      />

      <ServiceRequestModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
      />

    </div>
  );
}
