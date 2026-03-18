'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PendingMenu {
  id: string;
  url: string;
  submitted_at: string;
  restaurant_id: string;
  restaurants: { name: string } | null;
}

export default function PendingMenusPage() {
  const [menus, setMenus] = useState<PendingMenu[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMenus = useCallback(async () => {
    const { data } = await supabase
      .from('menu_entries')
      .select('id, url, submitted_at, restaurant_id, restaurants(name)')
      .eq('verification_status', 'pending')
      .eq('is_hidden', false)
      .order('submitted_at', { ascending: false })
      .limit(50);
    setMenus((data ?? []) as PendingMenu[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadMenus(); }, [loadMenus]);

  const handleAction = async (menuId: string, action: 'approve' | 'reject') => {
    const status = action === 'approve' ? 'approved' : 'rejected';
    await supabase.from('menu_entries').update({
      verification_status: status,
      verified_at: new Date().toISOString(),
    }).eq('id', menuId);
    loadMenus();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Pending Menus ({menus.length})</h1>
      {menus.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No pending menus.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Restaurant</th>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>URL</th>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Date</th>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{m.restaurants?.name ?? '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a' }}>{m.url}</a>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                  {new Date(m.submitted_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleAction(m.id, 'approve')}
                    style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, marginRight: 8, cursor: 'pointer', fontSize: 13 }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(m.id, 'reject')}
                    style={{ padding: '6px 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
