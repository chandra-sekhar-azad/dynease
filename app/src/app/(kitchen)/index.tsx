import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import apiClient from '../../api/client';
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

export default function KitchenDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await apiClient.get('/restaurant/orders?type=live');
      if (res.data?.success) {
        const list = res.data.data.orders.map((o: any) => ({ ...o, id: o._id }));
        setOrders(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await apiClient.patch(`/restaurant/orders/${orderId}/status`, { status });
      fetchOrders();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const getStatus = (s: string) => {
    if (s === 'ORDERED' || s === 'PENDING' || s === 'READ') return 'Pending';
    if (s === 'PREPARING') return 'In Progress';
    if (s === 'READY') return 'Ready';
    if (s === 'SERVED') return 'Served';
    return s;
  };

  useEffect(() => {
    let mounted = true;
    fetchOrders();
    (async () => {
      try {
        const me = await apiClient.get('/auth/me');
        const user = me.data?.data?.user;
        const rid = user?.restaurantId?.id || user?.restaurantId?._id;
        if (rid) setRestaurantId(rid);
      } catch (e) {
        console.error(e);
      }
    })();

    const socket = io(resolveSocketUrl(), { transports: ['websocket', 'polling'], auth: {} });
    socketRef.current = socket;
    socket.on('connect', () => {
      if (restaurantId) socket.emit('kitchen:join', restaurantId);
    });
    socket.on('new_order', fetchOrders);
    socket.on('order_updated', fetchOrders);

    const int = setInterval(fetchOrders, 2000);
    return () => {
      mounted = false;
      clearInterval(int);
      socket.disconnect();
    };
  }, [restaurantId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kitchen Display System</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={async () => {
          await SecureStore.deleteItemAsync('token');
          await SecureStore.deleteItemAsync('role');
          router.replace('/');
        }}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
      {loading && <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />}
      
      <ScrollView
        horizontal
        style={styles.board}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchOrders} colors={['#fff']} />}
      >
        {/* Pending Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Pending</Text>
          {orders.filter((o) => getStatus(o.status) === 'Pending').map((order) => (
            <View key={order.id} style={styles.ticket}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketId}>#{order.orderNumber || order.id.slice(0, 6)}</Text>
                <Text style={styles.ticketTable}>{order.tableNumber || 'Table'}</Text>
              </View>
              <View style={styles.ticketItems}>
                {(order.items || []).map((item: any, i: number) => (
                  <Text key={i} style={styles.itemText}>- {item.quantity || item.qty}x {item.itemName || item.name}</Text>
                ))}
              </View>
              <TouchableOpacity style={[styles.actionButton, styles.progressBtn]} onPress={() => updateStatus(order.id, 'PREPARING')}>
                <Text style={styles.actionText}>Start Cooking</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* In Progress Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>In Progress</Text>
          {orders.filter((o) => getStatus(o.status) === 'In Progress').map((order) => (
            <View key={order.id} style={styles.ticket}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketId}>#{order.orderNumber || order.id.slice(0, 6)}</Text>
                <Text style={styles.ticketTable}>{order.tableNumber || 'Table'}</Text>
              </View>
              <View style={styles.ticketItems}>
                {(order.items || []).map((item: any, i: number) => (
                  <Text key={i} style={styles.itemText}>- {item.quantity || item.qty}x {item.itemName || item.name}</Text>
                ))}
              </View>
              <TouchableOpacity style={[styles.actionButton, styles.readyBtn]} onPress={() => updateStatus(order.id, 'READY')}>
                <Text style={styles.actionText}>Mark Ready</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Ready Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Ready</Text>
          {orders.filter((o) => getStatus(o.status) === 'Ready').map((order) => (
            <View key={order.id} style={styles.ticket}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketId}>#{order.orderNumber || order.id.slice(0, 6)}</Text>
                <Text style={styles.ticketTable}>{order.tableNumber || 'Table'}</Text>
              </View>
              <View style={styles.ticketItems}>
                {(order.items || []).map((item: any, i: number) => (
                  <Text key={i} style={styles.itemText}>- {item.quantity || item.qty}x {item.itemName || item.name}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Dark theme for kitchen
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1e293b',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#ef4444',
    borderRadius: 6,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  board: {
    flex: 1,
    padding: 20,
  },
  column: {
    width: 300,
    marginRight: 20,
  },
  columnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 15,
  },
  ticket: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  ticketId: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  ticketTable: {
    color: '#64748b',
    fontWeight: '600',
  },
  ticketItems: {
    marginBottom: 15,
  },
  itemText: {
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 4,
  },
  actionButton: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  progressBtn: {
    backgroundColor: '#0284c7',
  },
  readyBtn: {
    backgroundColor: '#16a34a',
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
