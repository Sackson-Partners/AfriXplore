import { Model } from '@nozbe/watermelondb';
import { field, text, json } from '@nozbe/watermelondb/decorators';

export class Report extends Model {
  static table = 'reports';

  @text('server_id') serverId!: string | null;
  @text('mineral_type') mineralType!: string;
  @text('mineral_type_secondary') mineralTypeSecondary!: string | null;
  @text('working_type') workingType!: string;
  @field('depth_estimate_m') depthEstimateM!: number | null;
  @text('volume_estimate') volumeEstimate!: string | null;
  @text('host_rock') hostRock!: string | null;
  @text('alteration_colour') alterationColour!: string | null;
  @field('latitude') latitude!: number;
  @field('longitude') longitude!: number;
  @field('location_accuracy_m') locationAccuracyM!: number | null;
  @json('photos', (raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw))
  photos!: Array<{ uri: string; blobPath?: string; caption?: string }>;
  @text('voice_note_path') voiceNotePath!: string | null;
  @text('voice_note_transcript') voiceNoteTranscript!: string | null;
  @text('status') status!: string;
  @text('sync_status') syncStatus!: string;
  @json('ai_predictions', (raw) => (raw ? JSON.parse(raw) : null))
  aiPredictions!: Array<{ mineral: string; probability: number }> | null;
  @field('ai_confidence') aiConfidence!: number | null;
  @field('created_at_local') createdAtLocal!: number;
  @field('synced_at') syncedAt!: number | null;
  @field('retry_count') retryCount!: number;
}
