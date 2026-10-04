import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CloudProvider } from '@/components/cloud-provider';
export const metadata: Metadata = {
  title: 'One More Game · Ben & Sharon',
  description: 'A little friendly rivalry. A personal Scrabble journal for Ben and Sharon.',
  applicationName: 'One More Game',
  manifest: '/manifest-sb.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'One More Game' },
  icons: { icon: '/icon-sb.svg', apple: '/apple-touch-icon-sb.png' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8f6ef' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><CloudProvider>{children}</CloudProvider></body></html>;
}
