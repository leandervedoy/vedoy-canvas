import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Vedøy Canvas — Visual workspaces for clear thinking',
    template: '%s · Vedøy Canvas',
  },
  description: 'Sketch ideas, organize visual notes, and turn rough thinking into clear workspaces.',
  applicationName: 'Vedøy Canvas',
  generator: 'Next.js',
  keywords: ['visual workspace', 'canvas', 'visual notes', 'brainstorming', 'Vedøy'],
  referrer: 'strict-origin-when-cross-origin',
  icons: { icon: '/icon.png' },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#141414' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb" className="bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
