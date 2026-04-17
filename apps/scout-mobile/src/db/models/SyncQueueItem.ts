import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class SyncQueueItem extends Model {
  static table = 'sync_queue';

  @text('entity_type') entityType!: string;
  @text('entity_id') entityId!: string;
  @text('action') action!: string;
  @text('payload') payload!: string;
  @field('attempts') attempts!: number;
  @field('last_attempt') lastAttempt!: number | null;
  @text('error') error!: string | null;
  @field('created_at') createdAt!: number;
}
