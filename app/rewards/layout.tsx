import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rewards | GoTop Donuts',
  description:
    'Join GoTop Donuts rewards program. Earn points on every order and redeem them for discounts on fresh donuts and breakfast in Tyler, TX.',
};

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
