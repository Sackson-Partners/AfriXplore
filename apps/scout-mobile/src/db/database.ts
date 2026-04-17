import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { Report } from './models/Report';
import { ScoutProfile } from './models/ScoutProfile';
import { MineralPrice } from './models/MineralPrice';
import { SyncQueueItem } from './models/SyncQueueItem';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'afrixplore_scout',
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Report, ScoutProfile, MineralPrice, SyncQueueItem],
});

export default database;
