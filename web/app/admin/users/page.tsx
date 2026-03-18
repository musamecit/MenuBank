'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string | null;
  reputation_points: number;
  is_admin: boolean;
  is_banned: boolean;
  strike_points: number;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, reputation_points, is_admin, is_banned, strike_points, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    setUsers((data ?? []) as UserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleBan = async (userId: string, currentlyBanned: boolean) => {
    await supabase.from('user_profiles').update({
      is_banned: !currentlyBanned,
      banned_at: currentlyBanned ? null : new Date().toISOString(),
    }).eq('id', userId);
    load();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Users ({users.length})</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Email</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Rep</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Strikes</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Role</th>
            <th style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{u.email ?? u.id.slice(0, 8)}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{u.reputation_points}</td>
              <td style={{ padding: '12px 16px', fontSize: 14 }}>{u.strike_points}</td>
              <td style={{ padding: '12px 16px', fontSize: 13 }}>
                {u.is_admin ? <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Admin</span> : 'User'}
                {u.is_banned && <span style={{ color: '#ef4444', marginLeft: 8 }}>BANNED</span>}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <button
                  onClick={() => toggleBan(u.id, u.is_banned)}
                  style={{
                    padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                    background: u.is_banned ? '#16a34a' : '#ef4444', color: '#fff',
                  }}
                >
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
