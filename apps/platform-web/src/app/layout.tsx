import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AfriXplore — Mineral Intelligence Platform',
  description: 'AI-powered mineral exploration intelligence across Africa',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
