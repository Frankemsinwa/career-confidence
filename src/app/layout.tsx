import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Header from '@/components/layout/header';
import { SupabaseAuthProvider } from '@/contexts/supabase-auth-context';

const geistSans = GeistSans; // Use the direct import
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'Career Confidence',
  description: 'AI-powered interview preparation to boost your confidence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SupabaseAuthProvider>
          <Header />
          <main>{children}</main>
          <Toaster />
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
