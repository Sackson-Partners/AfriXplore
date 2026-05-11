import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { syncService } from '../services/syncService';
import { apiClient } from '../services/apiClient';

const queryClient = new QueryClient();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerFCMToken() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } = existing === 'granted'
      ? { status: existing }
      : await Notifications.requestPermissionsAsync();

    if (status !== 'granted') return;

    // Expo push token wraps FCM/APNs — the server uses the raw FCM token
    const token = (await Notifications.getExpoPushTokenAsync()).data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('afrixplore_alerts', {
        name: 'AfriXplore Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const accessToken = await SecureStore.getItemAsync('access_token');
    if (accessToken) {
      await apiClient.patch('/scout/v1/scouts/me', { fcm_token: token }, accessToken);
    }
  } catch {
    // Push registration is best-effort — don't block app startup
  }
}

export default function RootLayout() {
  useEffect(() => {
    syncService.start();
    registerFCMToken();
    return () => syncService.stop();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
