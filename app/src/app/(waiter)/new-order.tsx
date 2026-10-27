import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';

export default function NewOrderScreen() {
  const router = useRouter();
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['ALL']);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeVisitsMap, setActiveVisitsMap] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      const [tablesRes, menuRes, ordersRes] = await Promise.all([
        apiClient.get('/restaurant/tables').catch(() => ({ data: { success: false, data: { tables: [] } } })),
        apiClient.get('/restaurant/menu').catch(() => ({ data: { success: false, data: { menuItems: [] } } })),
        apiClient.get('/restaurant/orders').catch(() => ({ data: { success: false, data: { orders: [] } } })),
      ]);

      // Process Tables
      if (tablesRes.data?.success && tablesRes.data.data?.tables) {
        const rawTables = tablesRes.data.data.tables.filter((t: any) => !t.is_deleted);
        setTables(rawTables);
        if (rawTables.length > 0 && !selectedTable) {
          setSelectedTable(rawTables[0]);
        }
      }

      // Process Active Orders to know which tables have active visits
      if (ordersRes.data?.success && ordersRes.data.data?.orders) {
        const active = ordersRes.data.data.orders.filter((o: any) =>
          !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        );
        const map: Record<string, string> = {};
        active.forEach((o: any) => {
          if (o.tableId) map[o.tableId] = o.id || o._id;
        });
        setActiveVisitsMap(map);
      }

      // Process Menu Items
      if (menuRes.data?.success) {
        const rawItems = menuRes.data.data?.menuItems || menuRes.data.data?.items || [];
        const available = rawItems.filter((i: any) => i.isAvailable !== false && i.menuItemStatus !== 'UNAVAILABLE');
        setMenuItems(available);

        // Derive categories
        const catSet = new Set<string>();
        available.forEach((item: any) => {
          const cat = item.categoryName || item.category || item.category_name;
          if (cat) catSet.add(cat);
        });
        setCategories(['ALL', ...Array.from(catSet)]);
      }
    } catch (err) {
      console.error('[NewOrder] Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addToCart = (item: any, selectedPortion?: any) => {
    const sizeName = selectedPortion?.name || selectedPortion?.size || '';
    const itemPrice = selectedPortion ? Number(selectedPortion.price) : Number(item.price || item.basePrice || 0);
    const cartKey = `${item.id || item._id}-${sizeName}`;

    setCart(prev => {
      const idx = prev.findIndex(ci => ci.cartKey === cartKey);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          cartKey,
          menuItemId: item.id || item._id,
          itemName: item.name || item.itemName,
          size: sizeName,
          price: itemPrice,
          quantity: 1,
        }
      ];
    });
  };

  const updateCartQty = (cartKey: string, delta: number) => {
    setCart(prev => {
      return prev
        .map(ci => {
          if (ci.cartKey === cartKey) {
            const nextQty = ci.quantity + delta;
            return nextQty > 0 ? { ...ci, quantity: nextQty } : null;
          }
          return ci;
        })
        .filter(Boolean);
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredMenuItems = menuItems.filter(item => {
    const cat = item.categoryName || item.category || item.category_name || '';
    if (selectedCategory !== 'ALL' && cat !== selectedCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = (item.name || item.itemName || '').toLowerCase().includes(q);
    const descMatch = (item.description || '').toLowerCase().includes(q);
    return nameMatch || descMatch;
  });

  const handlePlaceOrder = async () => {
    if (!selectedTable) {
      Alert.alert('Table Required', 'Please select a table to place an order.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Order', 'Please select at least one dish from the menu.');
      return;
    }

    const tableId = selectedTable.id || selectedTable._id;
    const tableCode = selectedTable.table_code || selectedTable.tableCode || selectedTable.table_number || 'Table';
    const activeVisitId = activeVisitsMap[tableId];

    setIsSubmitting(true);
    try {
      if (activeVisitId) {
        // Add items to existing active visit
        const payloadItems = cart.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          size: item.size || ''
        }));
        const res = await apiClient.post(`/restaurant/orders/${activeVisitId}/items`, {
          items: payloadItems
        });
        if (res.data?.success) {
          Alert.alert(
            '✓ Items Added!',
            `Added ${totalItemsCount} dish(es) to active Table ${tableCode} order.`,
            [{ text: 'OK', onPress: () => router.replace('/(waiter)') }]
          );
          setCart([]);
        } else {
          Alert.alert('Order Error', res.data?.message || 'Failed to add items to table.');
        }
      } else {
        // Fresh order creation
        const payloadItems = cart.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          size: item.size || ''
        }));
        const res = await apiClient.post('/public/orders', {
          tableId,
          customerName: 'Dine-in Guest',
          items: payloadItems
        });

        if (res.data?.success) {
          Alert.alert(
            '✓ Order Placed!',
            `Order created successfully for Table ${tableCode}.`,
            [{ text: 'View Live Orders', onPress: () => router.replace('/(waiter)') }]
          );
          setCart([]);
        } else {
          Alert.alert('Order Error', res.data?.message || 'Failed to place order.');
        }
      }
    } catch (err: any) {
      console.error('[NewOrder] Placement error:', err);
      Alert.alert('Order Failed', err.response?.data?.message || 'Network error while placing order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Table Selector Strip */}
      <View style={styles.tableStrip}>
        <View style={styles.tableStripHeader}>
          <Text style={styles.tableStripTitle}>Select Table</Text>
          {selectedTable ? (
            <View style={styles.selectedTableBadge}>
              <Text style={styles.selectedTableBadgeText}>
                Active: Table {selectedTable.table_code || selectedTable.tableCode || selectedTable.table_number}
              </Text>
            </View>
          ) : null}
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={tables}
          keyExtractor={(item) => String(item.id || item._id)}
          contentContainerStyle={styles.tableList}
          renderItem={({ item }) => {
            const isSelected = selectedTable && (selectedTable.id || selectedTable._id) === (item.id || item._id);
            const tableId = item.id || item._id;
            const hasVisit = !!activeVisitsMap[tableId];
            const code = item.table_code || item.tableCode || item.table_number || 'T';

            return (
              <TouchableOpacity
                style={[
                  styles.tableCard,
                  isSelected ? styles.tableCardSelected : null,
                  hasVisit ? styles.tableCardOccupied : null,
                ]}
                onPress={() => setSelectedTable(item)}
              >
                <View style={styles.tableCardRow}>
                  <View style={[styles.statusDot, { backgroundColor: hasVisit ? '#f59e0b' : '#22c55e' }]} />
                  <Text style={[styles.tableCodeText, isSelected ? styles.tableCodeTextSelected : null]}>
                    T{code}
                  </Text>
                </View>
                <Text style={[styles.tableSubText, isSelected ? styles.tableCodeTextSelected : null]}>
                  {hasVisit ? 'Occupied' : 'Vacant'}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Search & Categories Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu dishes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Categories horizontal scroll */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isSelected ? styles.categoryChipActive : null]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text style={[styles.categoryChipText, isSelected ? styles.categoryChipTextActive : null]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Menu Items List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading restaurant menu...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredMenuItems}
          keyExtractor={(item) => String(item.id || item._id)}
          contentContainerStyle={styles.menuList}
          renderItem={({ item }) => {
            const portions = item.portions && Array.isArray(item.portions) && item.portions.length > 0 ? item.portions : null;
            const basePrice = item.price || item.basePrice || (portions ? portions[0]?.price : 0);
            const isVeg = item.isVegetarian || item.foodType === 'VEG';

            return (
              <View style={styles.menuCard}>
                <View style={styles.menuCardTop}>
                  <View style={styles.menuCardDetails}>
                    <View style={styles.foodTypeBadge}>
                      <View style={[styles.foodTypeInner, { backgroundColor: isVeg ? '#16a34a' : '#ef4444' }]} />
                      <Text style={styles.menuItemName}>{item.name || item.itemName}</Text>
                    </View>
                    {item.description ? (
                      <Text style={styles.menuItemDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.menuItemPrice}>₹{Number(basePrice || 0).toFixed(0)}</Text>
                </View>

                {/* Portions or Simple Add */}
                {portions ? (
                  <View style={styles.portionsContainer}>
                    <Text style={styles.portionsLabel}>Select Size:</Text>
                    <View style={styles.portionsRow}>
                      {portions.map((p: any, idx: number) => {
                        const portionCartKey = `${item.id || item._id}-${p.name || p.size || ''}`;
                        const inCart = cart.find(ci => ci.cartKey === portionCartKey);

                        return (
                          <View key={idx} style={styles.portionButton}>
                            <View>
                              <Text style={styles.portionName}>{p.name || p.size}</Text>
                              <Text style={styles.portionPrice}>₹{Number(p.price).toFixed(0)}</Text>
                            </View>
                            {inCart ? (
                              <View style={styles.qtyControlRow}>
                                <TouchableOpacity
                                  style={styles.qtyBtn}
                                  onPress={() => updateCartQty(portionCartKey, -1)}
                                >
                                  <Ionicons name="remove" size={14} color="#15803d" />
                                </TouchableOpacity>
                                <Text style={styles.qtyNum}>{inCart.quantity}</Text>
                                <TouchableOpacity
                                  style={styles.qtyBtn}
                                  onPress={() => updateCartQty(portionCartKey, 1)}
                                >
                                  <Ionicons name="add" size={14} color="#15803d" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.addPortionBtn}
                                onPress={() => addToCart(item, p)}
                              >
                                <Text style={styles.addPortionBtnText}>+ Add</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={styles.simpleAddContainer}>
                    {(() => {
                      const simpleCartKey = `${item.id || item._id}-`;
                      const inCart = cart.find(ci => ci.cartKey === simpleCartKey);
                      if (inCart) {
                        return (
                          <View style={styles.qtyControlRow}>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQty(simpleCartKey, -1)}
                            >
                              <Ionicons name="remove" size={14} color="#15803d" />
                            </TouchableOpacity>
                            <Text style={styles.qtyNum}>{inCart.quantity}</Text>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQty(simpleCartKey, 1)}
                            >
                              <Ionicons name="add" size={14} color="#15803d" />
                            </TouchableOpacity>
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          style={styles.simpleAddBtn}
                          onPress={() => addToCart(item)}
                        >
                          <Ionicons name="add" size={16} color="#ffffff" />
                          <Text style={styles.simpleAddBtnText}>Add Dish</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>No dishes found</Text>
              <Text style={styles.emptySubtitle}>Try searching for a different dish name or category.</Text>
            </View>
          }
        />
      )}

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 ? (
        <View style={styles.cartBar}>
          <View style={styles.cartBarInfo}>
            <Text style={styles.cartBarItemsCount}>{totalItemsCount} items selected</Text>
            <Text style={styles.cartBarTotal}>Total: ₹{totalAmount.toFixed(0)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.placeOrderBtn, isSubmitting ? styles.placeOrderBtnDisabled : null]}
            onPress={handlePlaceOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.placeOrderBtnText}>
                  {selectedTable && activeVisitsMap[selectedTable.id || selectedTable._id]
                    ? 'Add to Table'
                    : 'Punch Order'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  tableStrip: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tableStripTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  selectedTableBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  selectedTableBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  tableList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  tableCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 80,
    alignItems: 'center',
  },
  tableCardSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  tableCardOccupied: {
    borderColor: '#f59e0b',
  },
  tableCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tableCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableCodeTextSelected: {
    color: '#ffffff',
  },
  tableSubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  searchSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  categoriesList: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryChipTextActive: {
    color: '#ffffff',
  },
  menuList: {
    padding: 14,
    paddingBottom: 90,
    gap: 10,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  menuCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  menuCardDetails: {
    flex: 1,
  },
  foodTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  foodTypeInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuItemDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  menuItemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  portionsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  portionsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  portionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 12,
  },
  portionName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  portionPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  addPortionBtn: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addPortionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  simpleAddContainer: {
    alignItems: 'flex-end',
    marginTop: 10,
  },
  simpleAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16a34a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  simpleAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
    paddingHorizontal: 4,
  },
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  cartBarInfo: {
    gap: 2,
  },
  cartBarItemsCount: {
    fontSize: 12,
    color: '#94a3b8',
  },
  cartBarTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  placeOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  placeOrderBtnDisabled: {
    opacity: 0.6,
  },
  placeOrderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
