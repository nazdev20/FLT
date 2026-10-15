import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pari-Mutuel Battle Engine',
  description: 'Rap battle wagering prototype with real-time pool odds, payment verification, and battle settlement workflows.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
