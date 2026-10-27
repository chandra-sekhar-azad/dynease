import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../../api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [restaurantName, setRestaurantName] = useState<string>('Dynease');
  const [loading, setLoading] = useState(true);
  const [isOnShift, setIsOnShift] = useState(true);
  const [isUpdatingShift, setIsUpdatingShift] = useState(false);
  const [tables, setTables] = useState<any[]>([]);

  const fetchProfileData = useCallback(async () => {
    try {
      const [meRes, tablesRes] = await Promise.all([
        apiClient.get('/auth/me'),
        apiClient.get('/restaurant/tables').catch(() => ({ data: { success: false, data: { tables: [] } } }))
      ]);

      if (meRes.data?.success && meRes.data.data?.user) {
        const u = meRes.data.data.user;
        setUser(u);
        const onShift = u.shiftStatus === 'ON_SHIFT' || u.availabilityStatus === 'AVAILABLE';
        setIsOnShift(onShift);

        const rName = u.restaurantId?.name || (await SecureStore.getItemAsync('restaurantName'));
        if (rName) setRestaurantName(rName);

        if (tablesRes.data?.success && tablesRes.data.data?.tables) {
          const allTables = tablesRes.data.data.tables;
          const assignedIds = new Set((u.assignedTables || []).map((t: any) => t.id || t._id || t.tableId || t));
          const matched = allTables.filter((tbl: any) => assignedIds.has(tbl.id || tbl._id));
          setTables(matched.length > 0 ? matched : u.assignedTables || []);
        } else {
          setTables(u.assignedTables || []);
        }
      }
    } catch (e) {
      console.error('[Profile] Error fetching:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

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
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to update shift');
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Could not update shift');
    } finally {
      setIsUpdatingShift(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your staff account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('token');
            await SecureStore.deleteItemAsync('subdomain');
            await SecureStore.deleteItemAsync('restaurantName');
            await SecureStore.deleteItemAsync('role');
            router.replace('/');
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load staff profile.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#16a34a" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.restaurantName}>{restaurantName}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>WAITER / FLOOR STAFF</Text>
            </View>
          </View>
        </View>

        {/* Shift Status Banner inside card */}
        <View style={styles.shiftBox}>
          <View>
            <Text style={styles.shiftTitle}>Duty Status</Text>
            <Text style={styles.shiftSubtext}>
              {isOnShift ? 'Active — Receiving order assignments' : 'Paused — No new assignments'}
            </Text>
          </View>
          <Switch
            value={isOnShift}
            onValueChange={handleToggleShift}
            disabled={isUpdatingShift}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={isOnShift ? '#16a34a' : '#f8fafc'}
          />
        </View>

        {/* Contact details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-outline" size={18} color="#64748b" />
            </View>
            <View>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="call-outline" size={18} color="#64748b" />
            </View>
            <View>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{user.phone || 'Not provided'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Assigned Tables Card */}
      <View style={styles.card}>
        <View style={styles.cardSectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="grid-outline" size={20} color="#16a34a" />
            <Text style={styles.sectionTitle}>Assigned Tables</Text>
          </View>
          <View style={styles.capacityBadge}>
            <Text style={styles.capacityText}>
              {tables.length} {tables.length === 1 ? 'Table' : 'Tables'}
            </Text>
          </View>
        </View>

        {tables.length === 0 ? (
          <View style={styles.emptyTablesBox}>
            <Ionicons name="information-circle-outline" size={24} color="#94a3b8" />
            <Text style={styles.emptyTablesText}>
              No tables specifically allocated yet. Restaurant manager or dynamic assignment will allocate active tables.
            </Text>
          </View>
        ) : (
          <View style={styles.tablesGrid}>
            {tables.map((tbl: any, idx: number) => {
              const code = tbl.tableCode || tbl.tableNumber || tbl.table_code || `T${idx + 1}`;
              const capacity = tbl.capacity || tbl.seatingCapacity;
              const isOccupied = tbl.is_occupied || tbl.status === 'OCCUPIED';

              return (
                <View key={tbl.id || tbl._id || idx} style={styles.tableChip}>
                  <View style={[styles.tableStatusDot, { backgroundColor: isOccupied ? '#f59e0b' : '#22c55e' }]} />
                  <View>
                    <Text style={styles.tableChipCode}>Table {code}</Text>
                    {capacity ? <Text style={styles.tableChipCap}>{capacity} Seats</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* App Support & Info */}
      <View style={styles.card}>
        <View style={styles.cardSectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="headset-outline" size={20} color="#16a34a" />
            <Text style={styles.sectionTitle}>System Support</Text>
          </View>
        </View>
        <Text style={styles.supportDesc}>
          For account or POS device support, contact Dynease Technical Support:
        </Text>
        <Text style={styles.supportEmail}>support@dynease.in</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Log Out of Staff Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 30,
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  restaurantName: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  shiftBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  shiftTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  shiftSubtext: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  detailsContainer: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 1,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  capacityBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  capacityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  emptyTablesBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    gap: 8,
  },
  emptyTablesText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  tableStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tableChipCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableChipCap: {
    fontSize: 10,
    color: '#64748b',
  },
  supportDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 4,
  },
  supportEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
});
