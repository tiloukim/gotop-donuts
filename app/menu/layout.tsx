import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menu | GoTop Donuts',
  description:
    'Browse our full menu of fresh donuts, kolaches, breakfast sandwiches, and drinks at GoTop Donuts in Tyler, TX. Order online for pickup or delivery.',
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
