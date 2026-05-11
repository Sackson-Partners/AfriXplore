import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '../../services/apiClient';
import database from '../../db/database';
import { syncService } from '../../services/syncService';

interface ScoutProfile {
  first_name: string;
  last_name: string;
  badge_level: 'bronze' | 'silver' | 'gold' | 'platinum';
  quality_score: number;
}

interface ReportStats {
  total: number;
  validated: number;
  pending: number;
  pending_payout_usd: number;
}

interface RecentReport {
  id: string;
  mineral_type: string;
  status: string;
  created_at: string;
}

const BADGE_COLORS: Record<string, string> = {
  bronze: '#B45309',
  silver: '#6B7280',
  gold: '#F59E0B',
  platinum: '#A855F7',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  validated: '#22C55E',
  rejected: '#EF4444',
  under_review: '#3B82F6',
  escalated: '#A855F7',
};

const MINERAL_COLORS: Record<string, string> = {
  gold: '#F59E0B',
  copper: '#B45309',
  cobalt: '#3B82F6',
  lithium: '#6EE7B7',
};

const TIPS = [
  'Higher DPI scores earn more rewards.',
  'Always record GPS coordinates for every find.',
  'Photos increase your reward by 2x.',
  'Submit reports promptly — freshness counts.',
  'Validated reports unlock higher badge tiers.',
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Rotating tip card
function TipCarousel() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setIndex(i => (i + 1) % TIPS.length);
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [opacity]);

  return (
    <View style={styles.tipCard}>
      <Text style={styles.tipHeader}>Tip</Text>
      <Animated.Text style={[styles.tipText, { opacity }]}>{TIPS[index]}</Animated.Text>
      <View style={styles.tipDots}>
        {TIPS.map((_, i) => (
          <View key={i} style={[styles.tipDot, i === index && styles.tipDotActive]} />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [profile, setProfile] = useState<ScoutProfile | null>(null);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoFailedCount, setPhotoFailedCount] = useState(0);
  const [retryingPhotos, setRetryingPhotos] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('access_token').then(token => {
      if (!token) router.replace('/auth/login');
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) { router.replace('/auth/login'); return; }

      const [profileData, statsData, reportsData] = await Promise.all([
        apiClient.get('/scout/v1/scouts/me', token),
        apiClient.get('/api/v1/reports/stats', token),
        apiClient.get('/api/v1/reports?page=1&page_size=3', token),
      ]);

      setProfile(profileData);
      setStats(statsData);
      setRecent(reportsData.data ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll local WatermelonDB for photo_failed reports so the scout knows
  // their photos didn't upload and can retry.
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const all = await (database.get('reports') as any).query().fetch();
        if (active) {
          setPhotoFailedCount(all.filter((r: any) => r.syncStatus === 'photo_failed').length);
        }
      } catch {
        // Local DB read failure — not fatal
      }
    };
    check();
    const interval = setInterval(check, 15_000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const handleRetryPhotos = async () => {
    setRetryingPhotos(true);
    try {
      await syncService.retryPhotoFailed();
      setPhotoFailedCount(0);
    } finally {
      setRetryingPhotos(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#F59E0B" size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const badgeColor = BADGE_COLORS[profile?.badge_level ?? 'bronze'] ?? '#6B7280';
  const badgeLabel = profile?.badge_level
    ? profile.badge_level.charAt(0).toUpperCase() + profile.badge_level.slice(1) + ' Scout'
    : 'Scout';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Photo upload failure banner */}
      {photoFailedCount > 0 && (
        <View style={styles.photoFailBanner}>
          <Text style={styles.photoFailText}>
            {photoFailedCount} report{photoFailedCount > 1 ? 's' : ''} failed to upload photos.
          </Text>
          <TouchableOpacity
            style={styles.photoFailRetry}
            onPress={handleRetryPhotos}
            disabled={retryingPhotos}
          >
            {retryingPhotos
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={styles.photoFailRetryText}>Retry</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>
          {getGreeting()}, {profile?.first_name ?? 'Scout'} 👋
        </Text>
        <View style={[styles.badgeChip, { backgroundColor: badgeColor + '22', borderColor: badgeColor }]}>
          <Text style={[styles.badgeChipText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      </View>

      {/* Quick Stats */}
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
      </View>
      <View style={styles.statsRow}>
        <StatCard label="Reports" value={stats?.total ?? 0} />
        <StatCard label="Validated" value={stats?.validated ?? 0} />
        <StatCard
          label="Pending Payout"
          value={`$${(stats?.pending_payout_usd ?? 0).toFixed(2)}`}
          sub="USD"
        />
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/report/new')}
      >
        <Text style={styles.ctaText}>+ Submit New Finding</Text>
      </TouchableOpacity>

      {/* Recent Activity */}
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/reports')}>
          <Text style={styles.viewAll}>View all →</Text>
        </TouchableOpacity>
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyRecent}>
          <Text style={styles.emptyRecentText}>No reports yet. Submit your first finding!</Text>
        </View>
      ) : (
        <View style={styles.recentList}>
          {recent.map(r => {
            const mineralColor = MINERAL_COLORS[r.mineral_type?.toLowerCase()] ?? '#6B7280';
            const statusColor = STATUS_COLORS[r.status] ?? '#6B7280';
            return (
              <View key={r.id} style={styles.recentCard}>
                <View style={styles.recentLeft}>
                  <View style={[styles.mineralDot, { backgroundColor: mineralColor }]} />
                  <Text style={styles.recentMineral}>{r.mineral_type}</Text>
                </View>
                <View style={styles.recentRight}>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                      {r.status.replace('_', ' ')}
                    </Text>
                  </View>
                  <Text style={styles.recentDate}>{relativeDate(r.created_at)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Tips */}
      <View style={styles.sectionLabel}>
        <Text style={styles.sectionTitle}>Scout Tips</Text>
      </View>
      <TipCarousel />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  scrollContent: { paddingBottom: 48 },
  loadingContainer: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6B7280', marginTop: 12, fontSize: 14 },

  greetingSection: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  greetingText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 10 },
  badgeChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeChipText: { fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 10, marginTop: 8,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  viewAll: { color: '#F59E0B', fontSize: 14, fontWeight: '600' },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#1f2937',
  },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statSub: { color: '#6B7280', fontSize: 10, marginBottom: 2 },
  statLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', textAlign: 'center' },

  ctaButton: {
    backgroundColor: '#F59E0B', borderRadius: 18, marginHorizontal: 16,
    padding: 20, alignItems: 'center', marginBottom: 28,
  },
  ctaText: { color: '#000', fontWeight: '800', fontSize: 18 },

  recentList: { paddingHorizontal: 16, gap: 8, marginBottom: 24 },
  recentCard: {
    backgroundColor: '#111827', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#1f2937',
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  mineralDot: { width: 10, height: 10, borderRadius: 5 },
  recentMineral: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  recentRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  recentDate: { color: '#6B7280', fontSize: 11 },

  emptyRecent: { paddingHorizontal: 20, marginBottom: 24 },
  emptyRecentText: { color: '#6B7280', fontSize: 14 },

  tipCard: {
    backgroundColor: '#111827', borderRadius: 16, marginHorizontal: 16,
    padding: 20, borderWidth: 1, borderColor: '#1f2937',
  },
  tipHeader: { color: '#F59E0B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  tipText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, minHeight: 44 },
  tipDots: { flexDirection: 'row', gap: 6, marginTop: 14 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1f2937' },
  tipDotActive: { backgroundColor: '#F59E0B' },

  errorText: { color: '#EF4444', fontSize: 15, marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 },
  retryButton: { backgroundColor: '#F59E0B', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#000', fontWeight: '700', fontSize: 15 },

  photoFailBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#7F1D1D', borderRadius: 12, marginHorizontal: 16,
    marginTop: 56, marginBottom: 4, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: '#EF4444',
  },
  photoFailText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 12 },
  photoFailRetry: {
    backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, minWidth: 60, alignItems: 'center',
  },
  photoFailRetryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
