'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/menus', label: 'Pending Menus' },
  { href: '/admin/claims', label: 'Claims' },
  { href: '/admin/restaurants', label: 'Restaurants' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 220, background: '#0f172a', padding: '24px 0', flexShrink: 0 }}>
        <h2 style={{ color: '#22c55e', fontSize: 18, fontWeight: 700, padding: '0 20px', marginBottom: 24 }}>
          Admin
        </h2>
        {navItems.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: 'block', padding: '10px 20px', color: pathname === href ? '#22c55e' : '#94a3b8',
              fontWeight: pathname === href ? 600 : 400, fontSize: 14, textDecoration: 'none',
              background: pathname === href ? '#1e293b' : 'transparent',
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
      <main style={{ flex: 1, padding: 32, background: '#f8fafc' }}>
        {children}
      </main>
    </div>
  );
}
