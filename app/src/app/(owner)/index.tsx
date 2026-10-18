import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
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

export default function OwnerDashboard() {
  const [restaurantName, setRestaurantName] = useState('...');
  const [stats, setStats] = useState({ todaysOrders: 0, revenue: 0, activeTables: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const fetchName = async () => {
    const name = await SecureStore.getItemAsync('restaurantName');
    if (name) setRestaurantName(name);
  };

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/restaurant/stats');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetchName();
    fetchStats();
    (async () => {
      try {
        const me = await apiClient.get('/auth/me');
        const user = me.data?.data?.user;
        const rid = user?.restaurantId?.id || user?.restaurantId?._id;
        if (rid) {
          setRestaurantId(rid);
          if (mounted && socketRef.current?.connected) {
            socketRef.current.emit('restaurant:join', rid);
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();

    const socket = io(resolveSocketUrl(), { transports: ['websocket', 'polling'], auth: {} });
    socketRef.current = socket;
    socket.on('connect', () => {
      if (restaurantId) socket.emit('restaurant:join', restaurantId);
    });
    socket.on('order_updated', fetchStats);
    socket.on('new_order', fetchStats);
    socket.on('table_updated', fetchStats);

    const int = setInterval(fetchStats, 2000);
    return () => {
      mounted = false;
      clearInterval(int);
      socket.disconnect();
    };
  }, [restaurantId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchName();
    await fetchStats();
    setRefreshing(false);
  }, []);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />
      }
    >
      <Text style={styles.title}>Welcome to </Text>
      <Text style={{fontSize: 18, fontWeight: 'bold', color: '#16a34a', marginBottom: 20}}>{restaurantName.toUpperCase()}</Text>
      
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Orders</Text>
          <Text style={[styles.cardValue, { color: '#16a34a' }]}>{stats.todaysOrders}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revenue</Text>
          <Text style={[styles.cardValue, { color: '#16a34a' }]}>₹{stats.revenue}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Tables</Text>
          <Text style={[styles.cardValue, { color: '#2563eb' }]}>{stats.activeTables}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  cardContainer: {
    gap: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardTitle: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  }
});
