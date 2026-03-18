import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://byjcxrgcrcxeklhfmqxr.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
);

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabase
    .from('restaurants')
    .select('name, city_name, area_name')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (!data) return { title: 'Restaurant Not Found' };
  const r = data as { name: string; city_name: string; area_name: string };
  return {
    title: `${r.name} - MenuBank`,
    description: `View the menu for ${r.name} in ${r.area_name}, ${r.city_name}`,
  };
}

export default async function RestaurantPage({ params }: Props) {
  const { id } = await params;
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, city_name, area_name, formatted_address, image_url, is_verified, google_rating')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle();

  if (!restaurant) {
    return (
      <main style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1>Restaurant Not Found</h1>
        <p style={{ color: '#6b7280', marginTop: 12 }}>This restaurant may have been removed.</p>
      </main>
    );
  }

  const r = restaurant as {
    id: string; name: string; city_name: string; area_name: string;
    formatted_address?: string; image_url?: string; is_verified: boolean; google_rating?: number;
  };

  const { data: menus } = await supabase
    .from('menu_entries')
    .select('id, url, submitted_at')
    .eq('restaurant_id', id)
    .eq('verification_status', 'approved')
    .eq('is_hidden', false)
    .order('submitted_at', { ascending: false })
    .limit(5);

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      {r.image_url && (
        <img
          src={r.image_url}
          alt={r.name}
          style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 16, marginBottom: 24 }}
        />
      )}
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>
        {r.name}
        {r.is_verified && <span style={{ color: '#3B82F6', marginLeft: 8 }}>✓</span>}
      </h1>
      <p style={{ color: '#6b7280', marginTop: 4 }}>{r.area_name}, {r.city_name}</p>
      {r.formatted_address && <p style={{ color: '#9ca3af', marginTop: 2, fontSize: 14 }}>{r.formatted_address}</p>}
      {r.google_rating && <p style={{ marginTop: 8 }}>⭐ {r.google_rating.toFixed(1)}</p>}

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Menu</h2>
        {(menus ?? []).length > 0 ? (
          (menus as { id: string; url: string; submitted_at: string }[]).map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', padding: '12px 16px', marginBottom: 8, background: '#fff',
                borderRadius: 10, border: '1px solid #e5e7eb', color: '#16a34a',
              }}
            >
              {m.url}
              <span style={{ float: 'right', color: '#9ca3af', fontSize: 12 }}>
                {new Date(m.submitted_at).toLocaleDateString()}
              </span>
            </a>
          ))
        ) : (
          <p style={{ color: '#9ca3af' }}>No menus available yet.</p>
        )}
      </div>

      <div style={{ marginTop: 40, padding: '20px', background: '#f0fdf4', borderRadius: 12, textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#16a34a' }}>Get MenuBank App</p>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Discover menus, rate prices, and more.</p>
      </div>
    </main>
  );
}
