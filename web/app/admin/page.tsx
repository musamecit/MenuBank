'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Stats {
  restaurants: number;
  menus: number;
  users: number;
  pendingMenus: number;
  pendingClaims: number;
  verifiedRestaurants: number;
  bannedUsers: number;
  reports: number;
  totalEvents: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    restaurants: 0, menus: 0, users: 0, pendingMenus: 0, pendingClaims: 0,
    verifiedRestaurants: 0, bannedUsers: 0, reports: 0, totalEvents: 0,
  });
  const [recentAudit, setRecentAudit] = useState<{ action: string; entity_type: string; created_at: string }[]>([]);

  useEffect(() => {
    async function load() {
      const [
        { count: restaurants },
        { count: menus },
        { count: users },
        { count: pendingMenus },
        { count: pendingClaims },
        { count: verifiedRestaurants },
        { count: bannedUsers },
        { count: reports },
      ] = await Promise.all([
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('menu_entries').select('id', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('menu_entries').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('restaurant_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true),
        supabase.from('menu_reports').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        restaurants: restaurants ?? 0,
        menus: menus ?? 0,
        users: users ?? 0,
        pendingMenus: pendingMenus ?? 0,
        pendingClaims: pendingClaims ?? 0,
        verifiedRestaurants: verifiedRestaurants ?? 0,
        bannedUsers: bannedUsers ?? 0,
        reports: reports ?? 0,
        totalEvents: 0,
      });

      const { data: audit } = await supabase
        .from('admin_audit_log')
        .select('action, entity_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (audit) setRecentAudit(audit as { action: string; entity_type: string; created_at: string }[]);
    }
    load();
  }, []);

  const cards = [
    { label: 'Total Restaurants', value: stats.restaurants, color: '#16a34a' },
    { label: 'Verified', value: stats.verifiedRestaurants, color: '#3b82f6' },
    { label: 'Approved Menus', value: stats.menus, color: '#0ea5e9' },
    { label: 'Users', value: stats.users, color: '#8b5cf6' },
    { label: 'Banned Users', value: stats.bannedUsers, color: '#ef4444' },
    { label: 'Pending Menus', value: stats.pendingMenus, color: '#f59e0b' },
    { label: 'Pending Claims', value: stats.pendingClaims, color: '#f97316' },
    { label: 'Menu Reports', value: stats.reports, color: '#dc2626' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {cards.map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              background: '#fff', borderRadius: 12, padding: 20, borderLeft: `4px solid ${color}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <p style={{ fontSize: 13, color: '#6b7280' }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{value}</p>
          </div>
        ))}
      </div>

      {recentAudit.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Recent Admin Actions</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>Action</th>
                <th style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>Entity</th>
                <th style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((a, i) => (
                <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px 16px', fontSize: 14 }}>{a.action}</td>
                  <td style={{ padding: '10px 16px', fontSize: 14 }}>{a.entity_type}</td>
                  <td style={{ padding: '10px 16px', fontSize: 14, color: '#6b7280' }}>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
