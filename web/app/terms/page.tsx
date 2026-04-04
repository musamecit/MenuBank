import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - MenuBank',
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>Last updated: March 13, 2026</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>1. Acceptance of Terms</h2>
      <p>By using MenuBank, you agree to these Terms of Service.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>2. Description of Service</h2>
      <p>MenuBank allows users to discover, explore, and share restaurant menus worldwide.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>3. User Accounts</h2>
      <ul>
        <li>You must sign in using Google or Apple</li>
        <li>You must be at least 13 years old</li>
        <li>You are responsible for your account</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>4. User-Generated Content</h2>
      <p>By uploading content, you grant MenuBank a non-exclusive license to display it. You must not upload illegal, offensive, or misleading content.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>5. Subscriptions</h2>
      <p>Restaurant owners may subscribe to the Verified Badge plan for $49.99 USD/month. Subscriptions auto-renew and can be cancelled via Apple ID settings.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>6. Disclaimers</h2>
      <p>MenuBank is provided &quot;as is&quot; without warranties. Restaurant data is sourced from third parties.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>7. Governing Law</h2>
      <p>These Terms are governed by the laws of the Republic of Turkey.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>8. Contact</h2>
      <p>Musa Erdem Mecit — <a href="mailto:mecitmusa@gmail.com">mecitmusa@gmail.com</a></p>
    </main>
  );
}
