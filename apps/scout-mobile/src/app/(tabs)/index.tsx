import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AfriXplore Scout</Text>
      <Text style={styles.subtitle}>Help map Africa's minerals</Text>
      <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(tabs)/report/new')}>
        <Text style={styles.ctaButtonText}>+ Submit New Report</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 40 },
  ctaButton: { backgroundColor: '#F59E0B', borderRadius: 16, padding: 20, alignItems: 'center' },
  ctaButtonText: { color: '#000', fontWeight: '700', fontSize: 18 },
});
