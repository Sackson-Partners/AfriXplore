import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { syncService } from '../services/syncService';

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
