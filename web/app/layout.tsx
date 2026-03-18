import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MenuBank - Discover Restaurant Menus',
  description: 'Find and share restaurant menus worldwide. Browse menus, discover nearby restaurants, and contribute to the community.',
  openGraph: {
    title: 'MenuBank',
    description: 'Discover restaurant menus worldwide',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
