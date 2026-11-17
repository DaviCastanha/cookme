import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { DialogHost } from '@/components/ui/DialogHost';
import { ToastHost } from '@/components/ui/ToastHost';
import { SyncProvider } from '@/features/sync/SyncProvider';
import { PwaSetup } from '@/features/pwa/PwaSetup';
import { ThemeSync } from '@/features/theme/themeStore';
import { DEFAULT_THEME_ID, getTheme, themeBootScript } from '@/features/theme/themes';
import '@/styles/globals.scss';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });

export const metadata: Metadata = {
  // Absolute URLs for link previews (e.g. the photo of a public recipe on WhatsApp).
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: 'CookMe',
  description: 'Seu caderno de receitas: pastas, fotos, ingredientes e passo a passo.',
  applicationName: 'CookMe',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'CookMe', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: getTheme(DEFAULT_THEME_ID).bg,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The inline script sets data-theme before React hydrates; suppressHydrationWarning keeps it.
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body>
        {children}
        <ThemeSync />
        <SyncProvider />
        <PwaSetup />
        <DialogHost />
        <ToastHost />
      </body>
    </html>
  );
}
