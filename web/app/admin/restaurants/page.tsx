'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Restaurant {
  id: string;
  name: string;
  city_name: string;
  area_name: string;
  status: string;
  is_verified: boolean;
  created_at: string;
}

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, city_name, area_name, status, is_verified, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    setRestaurants((data ?? []) as Restaurant[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    await supabase.from('restaurants').update({ status: newStatus }).eq('id', id);
    load();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Restaurants ({restaurants.length})</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Name</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Location</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Status</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {restaurants.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>
                {r.name}
                {r.is_verified && <span style={{ color: '#3b82f6', marginLeft: 4 }}>✓</span>}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                {r.area_name}, {r.city_name}
              </td>
              <td style={{ padding: '12px 16px', fontSize: 13 }}>
                <span style={{ color: r.status === 'active' ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                  {r.status}
                </span>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <button
                  onClick={() => toggleStatus(r.id, r.status)}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    background: r.status === 'active' ? '#ef4444' : '#16a34a', color: '#fff',
                  }}
                >
                  {r.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
