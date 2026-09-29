import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'
import './globals.css'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: '800',
  variable: '--font-bricolage',
})

export const metadata: Metadata = {
  title: 'Guess My Number',
  description: 'A number on your forehead. Ask questions. Figure it out.',
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
