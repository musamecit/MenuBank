import { supabase } from './supabase';

export interface RestaurantRating {
  cheapness_score: number;
  value_score: number;
}

export interface RatingAggregate {
  avg_cheapness: number | null;
  avg_value: number | null;
  total_votes: number;
}

export async function submitRating(
  userId: string,
  restaurantId: string,
  cheapnessScore: number,
  valueScore: number,
): Promise<boolean> {
  const clamped = (v: number) => Math.min(5, Math.max(1, Math.round(v)));

  const { data: existing } = await supabase
    .from('restaurant_ratings')
    .select('id')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('restaurant_ratings')
      .update({
        cheapness_score: clamped(cheapnessScore),
        value_score: clamped(valueScore),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return !error;
  }

  const { error } = await supabase.from('restaurant_ratings').insert({
    user_id: userId,
    restaurant_id: restaurantId,
    cheapness_score: clamped(cheapnessScore),
    value_score: clamped(valueScore),
  });
  return !error;
}

export async function getUserRating(
  userId: string,
  restaurantId: string,
): Promise<RestaurantRating | null> {
  const { data } = await supabase
    .from('restaurant_ratings')
    .select('cheapness_score, value_score')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  return data as RestaurantRating | null;
}

export async function getRatingAggregate(
  restaurantId: string,
): Promise<RatingAggregate> {
  const { data } = await supabase
    .from('restaurant_rating_aggregates')
    .select('avg_cheapness, avg_value, total_votes')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (!data) return { avg_cheapness: null, avg_value: null, total_votes: 0 };
  return data as RatingAggregate;
}
