import axios from 'axios';
import { Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const resolveBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // If a production/remote URL is explicitly defined (not localhost/127.0.0.1), use it
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // 1. Web browser: localhost:5000 always points to the local machine
  if (Platform.OS === 'web') {
    return envUrl || 'http://localhost:5000/api';
  }

  // 2. Mobile device (Expo Go or Dev Client over Wi-Fi):
  // Constants.expoConfig?.hostUri contains the dev machine's LAN IP (e.g. 192.168.x.x:8081)
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
  const hostIp = hostUri ? hostUri.split(':')[0] : null;

  if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
    return `http://${hostIp}:5000/api`;
  }

  // 3. Android Emulator fallback: 10.0.2.2 maps to host machine loopback (localhost)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  // 4. iOS Simulator or default fallback
  return envUrl || 'http://localhost:5000/api';
};

const BASE_URL = resolveBaseUrl();
console.log(`[API Client] Development Base URL: ${BASE_URL}`);

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token in the future
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('token');
    const subdomain = await SecureStore.getItemAsync('subdomain');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (subdomain) {
      config.headers['x-tenant-subdomain'] = subdomain;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('role');
      await SecureStore.deleteItemAsync('subdomain');
      await SecureStore.deleteItemAsync('restaurantName');
      
      const { router } = require('expo-router');
      router.replace('/');

      // Return a clean error instead of the full AxiosError to avoid massive red stack traces on logout
      return Promise.reject(new Error('Session expired (401). Logged out automatically.'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
