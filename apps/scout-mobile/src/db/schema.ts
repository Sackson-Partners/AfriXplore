import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'reports',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'mineral_type', type: 'string' },
        { name: 'mineral_type_secondary', type: 'string', isOptional: true },
        { name: 'working_type', type: 'string' },
        { name: 'depth_estimate_m', type: 'number', isOptional: true },
        { name: 'volume_estimate', type: 'string', isOptional: true },
        { name: 'host_rock', type: 'string', isOptional: true },
        { name: 'alteration_colour', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'location_accuracy_m', type: 'number', isOptional: true },
        { name: 'photos', type: 'string' },
        { name: 'voice_note_path', type: 'string', isOptional: true },
        { name: 'voice_note_transcript', type: 'string', isOptional: true },
        { name: 'status', type: 'string' },
        { name: 'sync_status', type: 'string' },
        { name: 'ai_predictions', type: 'string', isOptional: true },
        { name: 'ai_confidence', type: 'number', isOptional: true },
        { name: 'created_at_local', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'retry_count', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'scout_profile',
      columns: [
        { name: 'server_id', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'full_name', type: 'string', isOptional: true },
        { name: 'country', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'kyc_status', type: 'string' },
        { name: 'total_earnings_usd', type: 'number' },
        { name: 'pending_earnings_usd', type: 'number' },
        { name: 'report_count', type: 'number' },
        { name: 'quality_score', type: 'number' },
        { name: 'badge_level', type: 'string' },
        { name: 'preferred_language', type: 'string' },
        { name: 'last_synced', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'mineral_prices',
      columns: [
        { name: 'mineral_type', type: 'string' },
        { name: 'price_usd_per_tonne', type: 'number' },
        { name: 'price_local', type: 'number', isOptional: true },
        { name: 'local_currency', type: 'string', isOptional: true },
        { name: 'nearest_buyer_name', type: 'string', isOptional: true },
        { name: 'nearest_buyer_phone', type: 'string', isOptional: true },
        { name: 'nearest_buyer_distance_km', type: 'number', isOptional: true },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'sync_queue',
      columns: [
        { name: 'entity_type', type: 'string' },
        { name: 'entity_id', type: 'string' },
        { name: 'action', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'attempts', type: 'number' },
        { name: 'last_attempt', type: 'number', isOptional: true },
        { name: 'error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
