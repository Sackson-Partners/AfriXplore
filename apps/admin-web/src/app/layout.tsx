import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AfriXplore Admin',
  description: 'AfriXplore Administration Portal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ background: '#0a0a0a', color: '#fafafa', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
