import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export class MineralPrice extends Model {
  static table = 'mineral_prices';

  @text('mineral_type') mineralType!: string;
  @field('price_usd_per_tonne') priceUsdPerTonne!: number;
  @field('price_local') priceLocal!: number | null;
  @text('local_currency') localCurrency!: string | null;
  @text('nearest_buyer_name') nearestBuyerName!: string | null;
  @text('nearest_buyer_phone') nearestBuyerPhone!: string | null;
  @field('nearest_buyer_distance_km') nearestBuyerDistanceKm!: number | null;
  @field('updated_at') updatedAt!: number;
}
