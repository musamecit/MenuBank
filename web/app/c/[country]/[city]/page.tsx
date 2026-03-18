import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import type { Metadata } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://byjcxrgcrcxeklhfmqxr.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
);

interface Props {
  params: Promise<{ country: string; city: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityName = decodeURIComponent(city).replace(/-/g, ' ');
  return {
    title: `Restaurants in ${cityName} - MenuBank`,
    description: `Browse restaurant menus in ${cityName}`,
  };
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  const cityName = decodeURIComponent(city).replace(/-/g, ' ');

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, area_name, image_url, is_verified, google_rating')
    .ilike('city_name', cityName)
    .eq('status', 'active')
    .order('trending_score', { ascending: false })
    .limit(50);

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>
        Restaurants in {cityName}
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {(restaurants ?? []).map((r: Record<string, unknown>) => (
          <Link
            key={String(r.id)}
            href={`/r/${r.id}`}
            style={{
              display: 'block', background: '#fff', borderRadius: 12, overflow: 'hidden',
              border: '1px solid #e5e7eb', textDecoration: 'none', color: 'inherit',
            }}
          >
            {r.image_url ? (
              <img src={String(r.image_url)} alt={String(r.name)} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: 160, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#9ca3af' }}>
                {String(r.name).charAt(0)}
              </div>
            )}
            <div style={{ padding: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 15 }}>
                {String(r.name)}
                {r.is_verified && <span style={{ color: '#3B82F6', marginLeft: 4 }}>✓</span>}
              </p>
              <p style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{String(r.area_name)}</p>
              {r.google_rating && (
                <p style={{ fontSize: 13, marginTop: 4 }}>⭐ {Number(r.google_rating).toFixed(1)}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
      {(restaurants ?? []).length === 0 && (
        <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 40 }}>No restaurants found in {cityName}.</p>
      )}
    </main>
  );
}
