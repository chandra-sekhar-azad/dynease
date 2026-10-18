import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import apiClient from '../../api/client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export default function WaiterDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [assignedTableIds, setAssignedTableIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const fetchOrders = async (fetchUser = false) => {
    try {
      let currentAssignedTables = assignedTableIds;
      
      if (fetchUser || assignedTableIds.length === 0) {
        const meRes = await apiClient.get('/auth/me');
        if (meRes.data?.success && meRes.data.data.user) {
          const assignedTablesData = meRes.data.data.user.assignedTables || [];
          currentAssignedTables = assignedTablesData.map((t: any) => t._id);
          setAssignedTableIds(currentAssignedTables);
        }
      }

      const ordersRes = await apiClient.get('/restaurant/orders');

      if (ordersRes.data?.success) {
        const activeOrders = ordersRes.data.data.orders.filter((o: any) => 
          !['COMPLETED', 'CANCELLED', 'PAID'].includes(o.status)
        );
        const newOrdersList = activeOrders.map((o: any) => ({ ...o, id: o._id }));
        
        setOrders(prevOrders => {
          if (prevOrders.length > 0 && currentAssignedTables.length > 0) {
            const prevIds = new Set(prevOrders.map(o => o.id));
            const freshlyPlaced = newOrdersList.filter((o: any) => 
              !prevIds.has(o.id) && currentAssignedTables.includes(o.tableId)
            );
            
            if (freshlyPlaced.length > 0) {
              const latestOrder = freshlyPlaced[0];
              const itemSummary = latestOrder.items?.map((i: any) => `${i.quantity || i.qty}x ${i.itemName || i.name}`).join('\n');
              
              Alert.alert(
                '🔔 New Order Placed!',
                `Table ${latestOrder.tableNumber || latestOrder.table}\n\n${itemSummary}`,
                [{ text: 'Got it' }]
              );
            }
          }
          return newOrdersList;
        });
      }
      setConnected(true);
    } catch (err) {
      console.error(err);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const upsertOrder = (orderPayload: any) => {
    const orderId = orderPayload?.id || orderPayload?._id;
    if (!orderId) return;
    setOrders((prev) => {
      const exists = prev.some((o: any) => o.id === orderId || o._id === orderId);
      if (exists) {
        return prev.map((o: any) =>
          (o.id === orderId || o._id === orderId) ? { ...o, ...orderPayload, id: orderId } : o
        );
      }
      return [{ ...orderPayload, id: orderId }, ...prev];
    });
  };

  useEffect(() => {
    let isMounted = true;
    fetchOrders(true);

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
              socket.emit('waiter:join', {
                restaurantId: user.restaurantId?.id || user.restaurantId?._id || user.restaurantId,
                waiterId: user.id,
              });
            }
          } catch (e) {
            console.error('Socket join error:', e);
          }
        });

        socket.on('disconnect', () => {
          if (isMounted) setConnected(false);
        });

        socket.on('new_order', upsertOrder);
        socket.on('assigned_order', upsertOrder);
        socket.on('order_updated', upsertOrder);
        socket.on('new_service_request', (payload: any) => {
          console.log('Service request:', payload);
        });
        socket.on('service_request_updated', (payload: any) => {
          console.log('Service request updated:', payload);
        });
      } catch (e) {
        console.error('Socket init failed:', e);
      }
    };

    initSocket();
    const interval = setInterval(() => {
      fetchOrders(false);
    }, 2000);

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearInterval(interval);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders(true);
    setRefreshing(false);
  }, []);

  const filteredOrders = assignedTableIds.length > 0
    ? orders.filter(o => assignedTableIds.includes(o.tableId))
    : orders;

  const updateOrderStatus = async (orderId: string, status: string, options?: { isReadByWaiter?: boolean }) => {
    try {
      const payload: any = { status };
      if (options?.isReadByWaiter !== undefined) {
        payload.isReadByWaiter = options.isReadByWaiter;
      }
      const res = await apiClient.patch(`/restaurant/orders/${orderId}/status`, payload);
      if (res.data?.success) {
        if (['COMPLETED', 'CANCELLED', 'PAID'].includes(status)) {
          // Optimistically update the UI by removing completed order
          setOrders(prev => prev.filter(o => o.id !== orderId));
          Alert.alert('Table Cleared', 'Order completed and table is now freed for next guests!');
        } else {
          // Update order status in place
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, isReadByWaiter: true } : o));
          Alert.alert('Order Acknowledged', 'Order marked as read.');
        }
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to update order status');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || 'An error occurred');
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isRead = item.isReadByWaiter || item.status !== 'PENDING';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.tableName}>Table {item.tableNumber || item.table}</Text>
            <Text style={styles.orderId}>{item.orderNumber || item.id?.substring(0,8)}</Text>
          </View>
          <View style={[styles.statusBadge, isRead ? styles.statusBadgeRead : styles.statusBadgePending]}>
            <Text style={[styles.statusText, isRead ? styles.statusTextRead : styles.statusTextPending]}>
              {isRead ? item.status : 'NEW (UNREAD)'}
            </Text>
          </View>
        </View>
        
        <View style={styles.itemsList}>
          {item.items?.map((orderItem: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Text style={styles.itemText}>{orderItem.quantity || orderItem.qty}x {orderItem.itemName || orderItem.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionButtonsRow}>
          {!isRead && (
            <TouchableOpacity 
              style={styles.readButton}
              onPress={() => updateOrderStatus(item.id, 'READ', { isReadByWaiter: true })}
            >
              <Ionicons name="eye-outline" size={18} color="#16a34a" />
              <Text style={styles.readButtonText}>Mark as Read</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.completeButton, !isRead ? styles.completeButtonCompact : null]}
            onPress={() => {
              Alert.alert(
                'Clear Table & Complete Order',
                `Are you sure Table ${item.tableNumber || item.table}'s order is completed? This will free the table for new customers and move this order to Past Orders.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Complete & Free Table', style: 'default', onPress: () => updateOrderStatus(item.id, 'COMPLETED') }
                ]
              );
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.completeButtonText}>Completed (Free Table)</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Live Orders</Text>
          <Text style={styles.subtitle}>Active orders for your assigned tables</Text>
        </View>
        <View style={[styles.connectionBadge, { backgroundColor: connected ? '#dcfce7' : '#fee2e2' }]}>
          <View style={[styles.dot, { backgroundColor: connected ? '#22c55e' : '#ef4444' }]} />
          <Text style={[styles.connectionText, { color: connected ? '#16a34a' : '#dc2626' }]}>
            {connected ? 'Live' : 'Disconnected'}
          </Text>
        </View>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#16a34a" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No active orders yet for your assigned tables.</Text>
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
    backgroundColor: '#f8fafc',
    padding: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 10,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  orderId: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgePending: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeRead: {
    backgroundColor: '#f0fdf4',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusTextPending: {
    color: '#d97706',
  },
  statusTextRead: {
    color: '#16a34a',
  },
  itemsList: {
    maxHeight: 120,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  itemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    marginTop: 20,
  },
  emptyText: {
    marginTop: 12,
    color: '#64748b',
    textAlign: 'center',
    fontSize: 16,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  readButton: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  readButtonText: {
    color: '#16a34a',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 13,
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  completeButtonCompact: {
    flex: 1.3,
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 13,
  }
});
