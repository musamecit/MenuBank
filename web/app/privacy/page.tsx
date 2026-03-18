import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - MenuBank',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '40px 24px', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>Last updated: March 16, 2026</p>

      <p>
        MenuBank (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is developed and operated by Musa Erdem Mecit
        (<a href="mailto:mecitmusa@gmail.com">mecitmusa@gmail.com</a>).
        This Privacy Policy explains what information we collect, how we use it, when we share it,
        how long we keep it, and what choices you have when using the MenuBank mobile application.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>1. Information We Collect</h2>
      <p><strong>Account Information:</strong> When you sign in with Google or Apple, we receive your name and email address to create and manage your account.</p>
      <p><strong>Location Data:</strong> With your permission, we access your device location to show nearby restaurants. Location data is used for app functionality and is not sold.</p>
      <p><strong>User-Generated Content:</strong> Menus, images, and other content you upload are stored and may be visible to other users.</p>
      <p><strong>Advertising:</strong> We display non-personalized banner ads via Google AdMob. See <a href="https://policies.google.com/privacy">Google&apos;s Privacy Policy</a>.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>2. How We Use Information</h2>
      <ul>
        <li>Create and manage accounts</li>
        <li>Display nearby restaurants and personalized content</li>
        <li>Process subscriptions</li>
        <li>Display advertisements</li>
        <li>Improve the app</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>3. Data Sharing</h2>
      <p>We do not sell personal data. We share data with: Supabase (infrastructure), Google (AdMob, Places, Sign-In), Apple (Sign-In, IAP).</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>4. Account Deletion</h2>
      <p>You can delete your account from the Profile screen within the app. Your data will be removed within 30 days.</p>

      <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32 }}>5. Contact</h2>
      <p>Musa Erdem Mecit — <a href="mailto:mecitmusa@gmail.com">mecitmusa@gmail.com</a></p>
    </main>
  );
}
