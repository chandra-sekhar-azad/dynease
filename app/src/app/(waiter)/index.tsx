import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import apiClient from '../../api/client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const resolveSocketUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/api$/, '');
  }
  if (Platform.OS === 'web') {
    return envUrl ? envUrl.replace(/\/api$/, '') : 'http://localhost:5000';
  }
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const hostIp = hostUri ? hostUri.split(':')[0] : null;
  if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
    return `http://${hostIp}:5000`;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }
  return envUrl ? envUrl.replace(/\/api$/, '') : 'http://localhost:5000';
};

const formatTimeAgo = (dateStr: string) => {
  if (!dateStr) return '';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  return `${diffHrs}h ago`;
};

const REQUEST_TYPE_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  call_waiter: { label: 'Call Waiter', icon: 'hand-left-outline', color: '#ea580c', bg: '#ffedd5' },
  water: { label: 'Water Request', icon: 'water-outline', color: '#0284c7', bg: '#e0f2fe' },
  bill: { label: 'Bill / Payment', icon: 'receipt-outline', color: '#16a34a', bg: '#dcfce7' },
  cutlery: { label: 'Cutlery Needed', icon: 'restaurant-outline', color: '#9333ea', bg: '#f3e8ff' },
  clean_table: { label: 'Clean Table', icon: 'sparkles-outline', color: '#ca8a04', bg: '#fef9c3' },
  custom: { label: 'Service Call', icon: 'notifications-outline', color: '#4f46e5', bg: '#e0e7ff' },
};

export default function WaiterDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'REQUESTS'>('ORDERS');
  const [orders, setOrders] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [assignedTables, setAssignedTables] = useState<any[]>([]);
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(true);
  const [restaurantName, setRestaurantName] = useState<string>('Dynease');
  const [waiterProfile, setWaiterProfile] = useState<any>(null);
  const [isOnShift, setIsOnShift] = useState<boolean>(true);
  const [isUpdatingShift, setIsUpdatingShift] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchAllData = useCallback(async (isInitial = false) => {
    try {
      const [meRes, ordersRes, requestsRes] = await Promise.all([
        apiClient.get('/auth/me'),
        apiClient.get('/restaurant/orders'),
        apiClient.get('/restaurant/service-requests').catch(() => ({ data: { success: false, data: { requests: [] } } }))
      ]);

      if (meRes.data?.success && meRes.data.data?.user) {
        const u = meRes.data.data.user;
        setWaiterProfile(u);
        const shift = u.shiftStatus === 'ON_SHIFT' || u.availabilityStatus === 'AVAILABLE';
        setIsOnShift(shift);

        const tablesData = u.assignedTables || [];
        setAssignedTables(tablesData);

        const restName = u.restaurantId?.name || (await SecureStore.getItemAsync('restaurantName'));
        if (restName) setRestaurantName(restName);
      }

      if (ordersRes.data?.success) {
        const rawOrders = ordersRes.data.data?.orders || [];
        const active = rawOrders.filter((o: any) =>
          !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        );
        const mapped = active.map((o: any) => ({
          ...o,
          id: o.id || o._id,
        }));
        setOrders(mapped);
      }

      if (requestsRes.data?.success) {
        const rawReqs = requestsRes.data.data?.requests || [];
        const activeReqs = rawReqs.filter((r: any) =>
          !['RESOLVED', 'CANCELLED', 'CLOSED'].includes(r.request_status || r.status)
        );
        setServiceRequests(activeReqs);
      }

      setConnected(true);
    } catch (err) {
      console.error('[WaiterApp] Fetch error:', err);
      setConnected(false);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  const handleToggleShift = async (value: boolean) => {
    setIsUpdatingShift(true);
    try {
      const payload = {
        shiftStatus: value ? 'ON_SHIFT' : 'OFF_SHIFT',
        availabilityStatus: value ? 'AVAILABLE' : 'OFF_SHIFT',
        acceptingOrders: value
      };
      const res = await apiClient.patch('/restaurant/waiters/my-availability', payload);
      if (res.data?.success) {
        setIsOnShift(value);
        Alert.alert(
          value ? '🟢 You are On Duty' : '⚪ You are Off Duty',
          value ? 'You will now receive table order assignments and service requests.' : 'Order assignments are paused.'
        );
      } else {
        Alert.alert('Status Error', res.data?.message || 'Failed to update duty status');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update shift status');
    } finally {
      setIsUpdatingShift(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const res = await apiClient.patch(`/restaurant/orders/${orderId}/accept`, {});
      if (res.data?.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PREPARING' } : o));
        Alert.alert('Order Accepted', 'Kitchen has been notified to begin food preparation.');
      }
    } catch (err: any) {
      // Fallback to direct status update
      try {
        const fallbackRes = await apiClient.patch(`/restaurant/orders/${orderId}/status`, { status: 'PREPARING' });
        if (fallbackRes.data?.success) {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PREPARING' } : o));
        }
      } catch (err2: any) {
        Alert.alert('Error', err.response?.data?.message || 'Failed to accept order');
      }
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string, tableCode: string) => {
    if (status === 'COMPLETED') {
      Alert.alert(
        'Complete & Free Table',
        `Are you sure Table ${tableCode} is done dining? This will mark all orders paid and free the table for new guests.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Free Table',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await apiClient.patch(`/restaurant/orders/${orderId}/status`, { status: 'COMPLETED' });
                if (res.data?.success) {
                  setOrders(prev => prev.filter(o => o.id !== orderId));
                  Alert.alert('Table Cleared', `Table ${tableCode} is now available for new diners.`);
                }
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.message || 'Failed to complete order');
              }
            }
          }
        ]
      );
      return;
    }

    try {
      const res = await apiClient.patch(`/restaurant/orders/${orderId}/status`, { status });
      if (res.data?.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update order status');
    }
  };

  const handleResolveRequest = async (requestId: string) => {
    try {
      const res = await apiClient.patch(`/restaurant/service-requests/${requestId}/resolve`, { status: 'RESOLVED' });
      if (res.data?.success) {
        setServiceRequests(prev => prev.filter(r => (r.id || r._id) !== requestId));
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to resolve service request');
    }
  };

  // Socket Connection
  useEffect(() => {
    let isMounted = true;
    fetchAllData(true);

    const initSocket = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const socket = io(resolveSocketUrl(), {
          transports: ['websocket', 'polling'],
          auth: token ? { token } : {},
        });
        socketRef.current = socket;

        socket.on('connect', async () => {
          if (!isMounted) return;
          setConnected(true);
          try {
            const meRes = await apiClient.get('/auth/me');
            const user = meRes.data?.data?.user;
            if (user) {
              const rid = user.restaurantId?.id || user.restaurantId?._id || user.restaurantId;
              socket.emit('waiter:join', {
                restaurantId: rid,
                waiterId: user.id || user._id,
              });
            }
          } catch (e) {
            console.error('Socket room join error:', e);
          }
        });

        socket.on('disconnect', () => {
          if (isMounted) setConnected(false);
        });

        socket.on('new_order', (payload: any) => {
          if (!isMounted || !payload) return;
          const orderId = payload.id || payload._id;
          setOrders(prev => {
            const exists = prev.some(o => o.id === orderId);
            if (exists) return prev;
            return [{ ...payload, id: orderId }, ...prev];
          });
        });

        socket.on('order_updated', (payload: any) => {
          if (!isMounted || !payload) return;
          const orderId = payload.id || payload._id || payload.orderId;
          if (['COMPLETED', 'CANCELLED', 'PAID'].includes(payload.status || payload.order?.status)) {
            setOrders(prev => prev.filter(o => o.id !== orderId));
          } else {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...payload, ...payload.order, id: orderId } : o));
          }
        });

        socket.on('new_service_request', (req: any) => {
          if (!isMounted || !req) return;
          setServiceRequests(prev => [req, ...prev.filter(r => (r.id || r._id) !== (req.id || req._id))]);
        });

        socket.on('service_request_updated', (req: any) => {
          if (!isMounted || !req) return;
          if (['RESOLVED', 'CANCELLED', 'CLOSED'].includes(req.request_status || req.status)) {
            setServiceRequests(prev => prev.filter(r => (r.id || r._id) !== (req.id || req._id)));
          } else {
            setServiceRequests(prev => prev.map(r => (r.id || r._id) === (req.id || req._id) ? { ...r, ...req } : r));
          }
        });
      } catch (err) {
        console.error('Socket initialization failed:', err);
      }
    };

    initSocket();
    const interval = setInterval(() => {
      fetchAllData(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchAllData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData(false);
    setRefreshing(false);
  }, [fetchAllData]);

  // Table filtering
  const filteredOrders = orders.filter(o => {
    if (selectedTableFilter === 'ALL') return true;
    const tableIdentifier = String(o.tableNumber || o.tableCode || o.table || o.table_number || '').trim().toUpperCase();
    return tableIdentifier === selectedTableFilter.toUpperCase();
  });

  const filteredRequests = serviceRequests.filter(r => {
    if (selectedTableFilter === 'ALL') return true;
    const tableIdentifier = String(r.tableNumber || r.tableCode || r.table || '').trim().toUpperCase();
    return tableIdentifier === selectedTableFilter.toUpperCase();
  });

  const renderOrderItem = ({ item }: { item: any }) => {
    const rawStatus = (item.status || 'ORDERED').toUpperCase();
    const tableDisplay = item.tableNumber || item.tableCode || item.table || 'Takeaway';
    const totalAmount = item.totalAmount || item.subtotal || item.total || 0;

    let statusBg = '#fef3c7';
    let statusText = '#b45309';
    let statusLabel = 'New Order';

    if (rawStatus === 'PREPARING' || rawStatus === 'READ' || rawStatus === 'CONFIRMED') {
      statusBg = '#dbeafe';
      statusText = '#1d4ed8';
      statusLabel = 'In Kitchen';
    } else if (rawStatus === 'READY') {
      statusBg = '#f3e8ff';
      statusText = '#7e22ce';
      statusLabel = 'Ready to Serve';
    } else if (rawStatus === 'SERVED') {
      statusBg = '#dcfce7';
      statusText = '#15803d';
      statusLabel = 'Served';
    }

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.tableBadgeWrapper}>
            <View style={styles.tableIconCircle}>
              <Ionicons name="grid" size={16} color="#16a34a" />
            </View>
            <View>
              <Text style={styles.tableName}>Table {tableDisplay}</Text>
              <Text style={styles.orderId}>
                #{item.orderNumber || (item.id ? String(item.id).substring(0, 8).toUpperCase() : 'ORD')}
                {item.createdAt ? ` • ${formatTimeAgo(item.createdAt)}` : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusBadgeText, { color: statusText }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsContainer}>
          {item.items && item.items.length > 0 ? (
            item.items.map((i: any, idx: number) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemQtyBadge}>
                  <Text style={styles.itemQtyText}>{i.quantity || i.qty || 1}x</Text>
                </View>
                <View style={styles.itemNameWrapper}>
                  <Text style={styles.itemNameText}>{i.itemName || i.name}</Text>
                  {i.portion || i.size ? (
                    <Text style={styles.itemPortionText}>({i.portion || i.size})</Text>
                  ) : null}
                </View>
                {i.price ? (
                  <Text style={styles.itemPriceText}>₹{((Number(i.price) || 0) * (Number(i.quantity) || 1)).toFixed(0)}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyItemsText}>Visit / Table active without individual items</Text>
          )}
        </View>

        {/* Total & Action Buttons */}
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{Number(totalAmount).toFixed(0)}</Text>
          </View>

          <View style={styles.actionsRow}>
            {rawStatus === 'ORDERED' || rawStatus === 'PENDING' ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={() => handleAcceptOrder(item.id)}
              >
                <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept</Text>
              </TouchableOpacity>
            ) : null}

            {rawStatus === 'PREPARING' || rawStatus === 'READY' || rawStatus === 'READ' ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.servedBtn]}
                onPress={() => handleUpdateStatus(item.id, 'SERVED', tableDisplay)}
              >
                <Ionicons name="restaurant-outline" size={16} color="#fff" />
                <Text style={styles.servedBtnText}>Mark Served</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.actionBtn, styles.completeBtn]}
              onPress={() => handleUpdateStatus(item.id, 'COMPLETED', tableDisplay)}
            >
              <Ionicons name="exit-outline" size={16} color="#475569" />
              <Text style={styles.completeBtnText}>Free Table</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderServiceRequestItem = ({ item }: { item: any }) => {
    const rawType = (item.request_type || item.type || 'custom').toLowerCase();
    const config = REQUEST_TYPE_CONFIG[rawType] || REQUEST_TYPE_CONFIG.custom;
    const tableDisplay = item.tableNumber || item.tableCode || item.table || 'Table';

    return (
      <View style={[styles.card, { borderLeftColor: config.color, borderLeftWidth: 4 }]}>
        <View style={styles.cardHeader}>
          <View style={styles.tableBadgeWrapper}>
            <View style={[styles.tableIconCircle, { backgroundColor: config.bg }]}>
              <Ionicons name={config.icon} size={18} color={config.color} />
            </View>
            <View>
              <Text style={styles.tableName}>Table {tableDisplay}</Text>
              <Text style={styles.orderId}>{config.label} • {formatTimeAgo(item.createdat || item.createdAt)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.statusBadgeText, { color: config.color }]}>Pending</Text>
          </View>
        </View>

        {item.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>"{item.notes}"</Text>
          </View>
        ) : null}

        <View style={styles.requestFooter}>
          <Text style={styles.requestHint}>Guest waiting at table</Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#16a34a', paddingHorizontal: 16 }]}
            onPress={() => handleResolveRequest(item.id || item._id)}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.acceptBtnText}>Resolve Request</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Banner: Shift Status & Connection */}
      <View style={styles.shiftBanner}>
        <View style={styles.shiftInfo}>
          <View style={[styles.connectionDot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
          <View>
            <Text style={styles.restaurantTitle}>{restaurantName}</Text>
            <Text style={styles.waiterNameText}>
              {waiterProfile?.name || 'Staff'} • {isOnShift ? 'On Shift (Active)' : 'Off Shift (Paused)'}
            </Text>
          </View>
        </View>

        <View style={styles.shiftSwitchWrapper}>
          <Text style={[styles.shiftToggleLabel, { color: isOnShift ? '#16a34a' : '#94a3b8' }]}>
            {isOnShift ? 'ON' : 'OFF'}
          </Text>
          <Switch
            value={isOnShift}
            onValueChange={handleToggleShift}
            disabled={isUpdatingShift}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={isOnShift ? '#16a34a' : '#f8fafc'}
          />
        </View>
      </View>

      {/* Assigned Tables Filter Strip */}
      {assignedTables.length > 0 ? (
        <View style={styles.tableFilterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['ALL', ...assignedTables.map(t => t.tableCode || t.tableNumber || `T${t.table_number || ''}`)]}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.tableFilterList}
            renderItem={({ item }) => {
              const isSelected = selectedTableFilter === item;
              return (
                <TouchableOpacity
                  style={[styles.tableFilterChip, isSelected ? styles.tableFilterChipActive : null]}
                  onPress={() => setSelectedTableFilter(item)}
                >
                  <Text style={[styles.tableFilterChipText, isSelected ? styles.tableFilterChipTextActive : null]}>
                    {item === 'ALL' ? 'All Assigned' : `Table ${item}`}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}

      {/* Tabs Header */}
      <View style={styles.tabsHeader}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ORDERS' ? styles.tabButtonActive : null]}
          onPress={() => setActiveTab('ORDERS')}
        >
          <Ionicons
            name="receipt-outline"
            size={18}
            color={activeTab === 'ORDERS' ? '#16a34a' : '#64748b'}
          />
          <Text style={[styles.tabButtonText, activeTab === 'ORDERS' ? styles.tabButtonTextActive : null]}>
            Live Orders
          </Text>
          {filteredOrders.length > 0 ? (
            <View style={[styles.tabBadge, activeTab === 'ORDERS' ? styles.tabBadgeActive : null]}>
              <Text style={[styles.tabBadgeText, activeTab === 'ORDERS' ? styles.tabBadgeTextActive : null]}>
                {filteredOrders.length}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'REQUESTS' ? styles.tabButtonActive : null]}
          onPress={() => setActiveTab('REQUESTS')}
        >
          <Ionicons
            name="notifications-outline"
            size={18}
            color={activeTab === 'REQUESTS' ? '#ea580c' : '#64748b'}
          />
          <Text style={[styles.tabButtonText, activeTab === 'REQUESTS' ? styles.tabButtonTextActive : null]}>
            Service Calls
          </Text>
          {filteredRequests.length > 0 ? (
            <View style={[styles.tabBadge, { backgroundColor: '#ea580c' }]}>
              <Text style={[styles.tabBadgeText, { color: '#fff' }]}>
                {filteredRequests.length}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Content List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Syncing live orders & tables...</Text>
        </View>
      ) : activeTab === 'ORDERS' ? (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                No active orders waiting for {selectedTableFilter === 'ALL' ? 'your assigned tables' : `Table ${selectedTableFilter}`}.
              </Text>
              <TouchableOpacity
                style={styles.newOrderShortcut}
                onPress={() => router.push('/(waiter)/new-order')}
              >
                <Ionicons name="add-circle-outline" size={18} color="#16a34a" />
                <Text style={styles.newOrderShortcutText}>Punch a Walk-in Order</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => String(item.id || item._id)}
          renderItem={renderServiceRequestItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No pending service requests</Text>
              <Text style={styles.emptySubtitle}>
                Diners can request water, bill, or assistance by scanning the table QR.
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
  shiftBanner: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  restaurantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  waiterNameText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  shiftSwitchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftToggleLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  tableFilterContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableFilterList: {
    paddingHorizontal: 14,
    gap: 8,
  },
  tableFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tableFilterChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  tableFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  tableFilterChipTextActive: {
    color: '#ffffff',
  },
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#16a34a',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#16a34a',
  },
  tabBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tabBadgeActive: {
    backgroundColor: '#dcfce7',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  tabBadgeTextActive: {
    color: '#15803d',
  },
  listContainer: {
    padding: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  orderId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  itemsContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemQtyBadge: {
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  itemQtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  itemNameWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  itemPortionText: {
    fontSize: 11,
    color: '#64748b',
  },
  itemPriceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  emptyItemsText: {
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
  totalLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  acceptBtn: {
    backgroundColor: '#16a34a',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  servedBtn: {
    backgroundColor: '#0284c7',
  },
  servedBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  completeBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  completeBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  notesBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  notesText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#92400e',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  requestHint: {
    fontSize: 12,
    color: '#64748b',
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
  emptyStateContainer: {
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
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  newOrderShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
  },
  newOrderShortcutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
});
