import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class ScoutProfile extends Model {
  static table = 'scout_profile';

  @text('server_id') serverId!: string;
  @text('phone') phone!: string;
  @text('full_name') fullName!: string | null;
  @text('country') country!: string;
  @text('status') status!: string;
  @text('kyc_status') kycStatus!: string;
  @field('total_earnings_usd') totalEarningsUsd!: number;
  @field('pending_earnings_usd') pendingEarningsUsd!: number;
  @field('report_count') reportCount!: number;
  @field('quality_score') qualityScore!: number;
  @text('badge_level') badgeLevel!: string;
  @text('preferred_language') preferredLanguage!: string;
  @field('last_synced') lastSynced!: number;
}
