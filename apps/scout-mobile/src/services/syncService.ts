import database from '../db/database';
import { Report } from '../db/models/Report';
import { apiClient } from './apiClient';
import * as FileSystem from 'expo-file-system';
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
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPendingReports(token: string) {
    const reportsCollection = database.get<Report>('reports');
    const pendingReports = await reportsCollection
      .query()
      .fetch();

    const pending = pendingReports.filter((r) => r.syncStatus === 'pending');

    for (const report of pending) {
      if (report.retryCount >= MAX_RETRIES) {
        await database.write(async () => {
          await report.update((r) => { r.syncStatus = 'failed'; });
        });
        continue;
      }

      try {
        const uploadedPhotos = await this.uploadPhotos(report, token);

        const response = await apiClient.post(
          '/scout/v1/reports',
          {
            latitude: report.latitude,
            longitude: report.longitude,
            location_accuracy_m: report.locationAccuracyM,
            mineral_type: report.mineralType,
            mineral_type_secondary: report.mineralTypeSecondary,
            working_type: report.workingType,
            depth_estimate_m: report.depthEstimateM,
            volume_estimate: report.volumeEstimate,
            host_rock: report.hostRock,
            alteration_colour: report.alterationColour,
            photos: uploadedPhotos,
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

      } catch (error) {
        await database.write(async () => {
          await report.update((r) => {
            r.retryCount = r.retryCount + 1;
            r.syncStatus = r.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
          });
        });
      }
    }
  }

  private async uploadPhotos(
    report: Report,
    token: string
  ): Promise<Array<{ url: string; blob_path: string }>> {
    const uploaded = [];

    for (const photo of report.photos) {
      if (photo.blobPath) {
        uploaded.push({ url: photo.uri, blob_path: photo.blobPath });
        continue;
      }

      const { upload_url, blob_path, cdn_url } = await apiClient.post(
        '/scout/v1/upload/presign',
        { filename: `report_${Date.now()}.jpg`, content_type: 'image/jpeg' },
        token
      );

      await FileSystem.uploadAsync(upload_url, photo.uri, {
        httpMethod: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': 'image/jpeg',
        },
      });

      uploaded.push({ url: cdn_url, blob_path });
    }

    return uploaded;
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
    } catch (error) {
      console.warn('Profile sync failed:', error);
    }
  }
}

export const syncService = new SyncService();
