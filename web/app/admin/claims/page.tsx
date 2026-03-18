'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Claim {
  id: string;
  restaurant_id: string;
  claimed_by: string;
  status: string;
  submitted_at: string;
  restaurants: { name: string } | null;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('restaurant_claims')
      .select('id, restaurant_id, claimed_by, status, submitted_at, restaurants(name)')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false })
      .limit(50);
    setClaims((data ?? []) as Claim[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (claimId: string, action: 'approved' | 'rejected') => {
    await supabase.from('restaurant_claims').update({
      status: action,
      reviewed_at: new Date().toISOString(),
    }).eq('id', claimId);
    load();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Pending Claims ({claims.length})</h1>
      {claims.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No pending claims.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Restaurant</th>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Claimed By</th>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Date</th>
              <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{c.restaurants?.name ?? '-'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{c.claimed_by.slice(0, 8)}...</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                  {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString() : '-'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => handleAction(c.id, 'approved')}
                    style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, marginRight: 8, cursor: 'pointer', fontSize: 13 }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(c.id, 'rejected')}
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
