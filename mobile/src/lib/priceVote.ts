import { supabase } from './supabase';

export type PriceVoteValue = 'cheap' | 'average' | 'expensive';

export async function submitPriceVote(
  userId: string,
  restaurantId: string,
  vote: PriceVoteValue,
) {
  const { data: existing } = await supabase
    .from('restaurant_price_votes')
    .select('id')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('restaurant_price_votes')
      .update({ vote })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('restaurant_price_votes')
      .insert({ user_id: userId, restaurant_id: restaurantId, vote });
  }
}

export async function getUserVote(
  userId: string,
  restaurantId: string,
): Promise<PriceVoteValue | null> {
  const { data } = await supabase
    .from('restaurant_price_votes')
    .select('vote')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  return (data as { vote: PriceVoteValue } | null)?.vote ?? null;
}

export interface PriceDistribution {
  cheap: number;
  average: number;
  expensive: number;
}

export async function getPriceDistribution(restaurantId: string): Promise<PriceDistribution> {
  const { data } = await supabase
    .from('restaurant_price_votes')
    .select('vote')
    .eq('restaurant_id', restaurantId);
  const dist: PriceDistribution = { cheap: 0, average: 0, expensive: 0 };
  (data ?? []).forEach((r: { vote: string }) => {
    if (r.vote in dist) dist[r.vote as keyof PriceDistribution]++;
  });
  return dist;
}
