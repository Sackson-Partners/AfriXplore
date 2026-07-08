import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/QueryProvider';
import { AuthProvider } from '@/components/AuthProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GeoSwarm — AI-Powered Drone Geophysics',
  description: 'AI-powered drone geophysics surveys for Africa. Sub-10cm resolution, anomaly detection, 48hr turnaround.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} bg-geo-obsidian text-geo-white antialiased`}
      >
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
