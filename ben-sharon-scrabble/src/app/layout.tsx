import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CloudProvider } from '@/components/cloud-provider';
export const metadata: Metadata = {
  title: 'Anniversary Series · Ben & Sharon',
  description: 'A little friendly rivalry. A personal Scrabble journal for Ben and Sharon.',
  applicationName: 'Anniversary Series',
  manifest: '/manifest-anniversary.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Anniversary Series' },
  icons: { icon: '/icon-sb.svg', apple: '/apple-touch-icon-sb.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8f6ef' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><CloudProvider>{children}</CloudProvider></body></html>;
}
