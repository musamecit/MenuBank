import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, color: '#16a34a', marginBottom: 16 }}>
        MenuBank
      </h1>
      <p style={{ fontSize: 20, color: '#6b7280', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.6 }}>
        Discover and share restaurant menus worldwide. Browse menus, find nearby restaurants, and contribute to the community.
      </p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a
          href="#"
          style={{
            display: 'inline-block', padding: '14px 32px', background: '#16a34a',
            color: '#fff', borderRadius: 12, fontSize: 16, fontWeight: 600,
          }}
        >
          Download on the App Store
        </a>
      </div>
      <div style={{ marginTop: 60, display: 'flex', gap: 24, justifyContent: 'center' }}>
        <Link href="/privacy" style={{ color: '#6b7280' }}>Privacy Policy</Link>
        <Link href="/terms" style={{ color: '#6b7280' }}>Terms of Service</Link>
      </div>
    </main>
  );
}
