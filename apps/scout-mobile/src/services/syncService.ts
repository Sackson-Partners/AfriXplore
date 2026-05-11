import database from '../db/database';
import { Report } from '../db/models/Report';
import { SyncQueueItem } from '../db/models/SyncQueueItem';
import { apiClient } from './apiClient';
import * as SecureStore from 'expo-secure-store';

const MAX_RETRIES = 3;
const SYNC_INTERVAL_MS = 30_000;

class SyncService {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  start() {
    this.syncTimer = setInterval(() => this.sync(), SYNC_INTERVAL_MS);
  }

  stop() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async sync() {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token || this.isSyncing) return;

    this.isSyncing = true;
    try {
      await this.syncPendingReports(token);
      await this.syncProfileFromServer(token);
      await this.cleanupSyncQueue();
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPendingReports(token: string) {
    const reportsCollection = database.get<Report>('reports');
    const allReports = await reportsCollection.query().fetch();
    const pending = allReports.filter((r) => r.syncStatus === 'pending');

    for (const report of pending) {
      if (report.retryCount >= MAX_RETRIES) {
        await database.write(async () => {
          await report.update((r) => { r.syncStatus = 'failed'; });
        });
        continue;
      }

      // Step 1: upload photos. Failures here are always counted against retries
      // because a persistent photo upload failure needs to surface to the scout
      // rather than silently looping forever.
      let photoUris: string[];
      try {
        photoUris = await this.uploadPhotos(report, token);
      } catch (photoErr) {
        await database.write(async () => {
          await report.update((r) => {
            r.retryCount = r.retryCount + 1;
            r.syncStatus = r.retryCount >= MAX_RETRIES ? 'photo_failed' : 'pending';
          });
        });
        continue;
      }

      // Step 2: submit report to the API.
      try {
        const response = await apiClient.post(
          '/api/v1/reports',
          {
            latitude: report.latitude,
            longitude: report.longitude,
            location_accuracy_m: report.locationAccuracyM,
            mineral_type: report.mineralType,
            working_type: report.workingType,
            depth_estimate_m: report.depthEstimateM,
            volume_estimate: report.volumeEstimate,
            photo_uris: photoUris,
            country: report.country ?? 'ZZ',
            district: report.district ?? undefined,
            offline_created_at: new Date(report.createdAtLocal).toISOString(),
          },
          token
        );

        await database.write(async () => {
          await report.update((r) => {
            r.serverId = response.id;
            r.syncStatus = 'synced';
            r.status = 'submitted';
            r.syncedAt = Date.now();
          });
        });

      } catch (err) {
        // Only count retries for server-side rejections (4xx). Network errors
        // and 5xx are transient — don't penalise the report for them.
        const status = (err as any)?.status ?? (err as any)?.response?.status;
        const isClientError = typeof status === 'number' && status >= 400 && status < 500;

        await database.write(async () => {
          await report.update((r) => {
            if (isClientError) {
              r.retryCount = r.retryCount + 1;
            }
            r.syncStatus = r.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
          });
        });
      }
    }
  }

  private async uploadPhotos(report: Report, token: string): Promise<string[]> {
    const uploaded: string[] = [];

    for (const photo of report.photos) {
      if (photo.blobPath) {
        uploaded.push(photo.uri);
        continue;
      }

      const result = await apiClient.uploadFile('/scout/v1/upload/photo', photo.uri, token);
      uploaded.push(result.url);
    }

    return uploaded;
  }

  /** Delete sync_queue entries older than 30 days. The table has no status
   *  column, so age is the only reliable signal that an item is done or
   *  permanently unrecoverable. */
  private async cleanupSyncQueue(): Promise<void> {
    try {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const all = await (database.get<SyncQueueItem>('sync_queue') as any).query().fetch() as SyncQueueItem[];
      const stale = all.filter((item) => item.createdAt < cutoff);
      if (stale.length === 0) return;
      await database.write(async () => {
        for (const item of stale) {
          await item.destroyPermanently();
        }
      });
    } catch {
      // Cleanup is best-effort — don't break the sync loop
    }
  }

  /** Reset photo_failed reports to pending and immediately retry sync. */
  async retryPhotoFailed(): Promise<void> {
    const reportsCollection = database.get<Report>('reports');
    const failed = await reportsCollection
      .query()
      .fetch()
      .then((all) => all.filter((r) => r.syncStatus === 'photo_failed'));

    if (failed.length === 0) return;

    await database.write(async () => {
      for (const report of failed) {
        await report.update((r) => {
          r.syncStatus = 'pending';
          r.retryCount = 0;
        });
      }
    });

    await this.sync();
  }

  private async syncProfileFromServer(token: string) {
    try {
      const profile = await apiClient.get('/scout/v1/scouts/me', token);
      const profiles = await database.get('scout_profile').query().fetch();

      await database.write(async () => {
        if (profiles.length > 0) {
          await (profiles[0] as any).update((p: any) => {
            p.totalEarningsUsd = profile.total_earnings_usd;
            p.pendingEarningsUsd = profile.pending_earnings_usd;
            p.reportCount = profile.report_count;
            p.qualityScore = profile.quality_score;
            p.badgeLevel = profile.badge_level;
            p.lastSynced = Date.now();
          });
        }
      });
    } catch {
      // Profile sync is best-effort — don't break the sync loop
    }
  }
}

export const syncService = new SyncService();
