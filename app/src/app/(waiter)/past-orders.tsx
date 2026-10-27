import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';

export default function PastOrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');

  const fetchOrders = useCallback(async () => {
    try {
      const ordersRes = await apiClient.get('/restaurant/orders');
      if (ordersRes.data?.success) {
        const rawOrders = ordersRes.data.data?.orders || [];
        const past = rawOrders.filter((o: any) =>
          ['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        );
        setOrders(past.map((o: any) => ({ ...o, id: o.id || o._id })));
      }
    } catch (err) {
      console.error('[PastOrders] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const filteredOrders = orders.filter((o: any) => {
    // Status filter
    if (statusFilter === 'COMPLETED' && o.status === 'CANCELLED') return false;
    if (statusFilter === 'CANCELLED' && o.status !== 'CANCELLED') return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const tableStr = String(o.tableNumber || o.tableCode || o.table || '').toLowerCase();
    const orderNumStr = String(o.orderNumber || o.id || '').toLowerCase();
    const itemsMatch = (o.items || []).some((i: any) =>
      String(i.itemName || i.name || '').toLowerCase().includes(q)
    );
    return tableStr.includes(q) || orderNumStr.includes(q) || itemsMatch;
  });

  const renderItem = ({ item }: { item: any }) => {
    const isCancelled = item.status === 'CANCELLED';
    const tableDisplay = item.tableNumber || item.tableCode || item.table || 'Takeaway';
    const totalAmount = item.totalAmount || item.subtotal || item.total || 0;
    const formattedDate = item.createdAt
      ? new Date(item.createdAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.tableInfo}>
            <View style={[styles.tableIconCircle, { backgroundColor: isCancelled ? '#fee2e2' : '#dcfce7' }]}>
              <Ionicons
                name={isCancelled ? 'close-circle' : 'checkmark-circle'}
                size={18}
                color={isCancelled ? '#ef4444' : '#16a34a'}
              />
            </View>
            <View>
              <Text style={styles.tableName}>Table {tableDisplay}</Text>
              <Text style={styles.orderId}>
                #{item.orderNumber || (item.id ? String(item.id).substring(0, 8).toUpperCase() : '')} • {formattedDate}
              </Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: isCancelled ? '#fee2e2' : '#dcfce7' }]}>
            <Text style={[styles.statusText, { color: isCancelled ? '#dc2626' : '#15803d' }]}>
              {isCancelled ? 'CANCELLED' : (item.status === 'PAID' ? 'PAID' : 'COMPLETED')}
            </Text>
          </View>
        </View>

        {/* Item list */}
        <View style={styles.itemsList}>
          {item.items && item.items.length > 0 ? (
            item.items.map((i: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemQty}>{i.quantity || i.qty || 1}x</Text>
                <Text style={styles.itemName}>
                  {i.itemName || i.name}
                  {i.portion || i.size ? ` (${i.portion || i.size})` : ''}
                </Text>
                {i.price ? (
                  <Text style={styles.itemPrice}>
                    ₹{((Number(i.price) || 0) * (Number(i.quantity) || 1)).toFixed(0)}
                  </Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.noItemsText}>Order completed</Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.itemsCountText}>
            {(item.items || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0)} items
          </Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total: </Text>
            <Text style={styles.totalAmount}>₹{Number(totalAmount).toFixed(0)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search & Filter Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search-outline" size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by table, order #, or dish..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterPillsRow}>
          {(['ALL', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterPill, statusFilter === s ? styles.filterPillActive : null]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.filterPillText, statusFilter === s ? styles.filterPillTextActive : null]}>
                {s === 'ALL' ? 'All' : s === 'COMPLETED' ? 'Completed' : 'Cancelled'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading past orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="time-outline" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No past orders found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No completed orders matched your search query.'
                  : 'Completed orders for this restaurant will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  searchBarContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 10,
  },
  searchInputWrapper: {
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
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemsList: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    width: 28,
  },
  itemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  noItemsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemsCountText: {
    fontSize: 12,
    color: '#64748b',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
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
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});
