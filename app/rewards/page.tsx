'use client';

import { useState, useEffect } from 'react';
import { REDEEM_POINTS, REDEEM_DISCOUNT } from '@/lib/constants';
import type { RewardTransaction } from '@/lib/types';

export default function RewardsPage() {
  const [points, setPoints] = useState(0);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rewards')
      .then((r) => r.json())
      .then((data) => {
        setPoints(data.points || 0);
        setTransactions(data.transactions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-gray-100 rounded-xl h-48 animate-pulse" />
      </div>
    );
  }

  const redeemable = Math.floor(points / REDEEM_POINTS);
  const progress = points % REDEEM_POINTS;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Rewards</h1>

      {/* Points Balance */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-8 text-white mb-8">
        <p className="text-sm opacity-80 mb-1">Your Balance</p>
        <p className="text-5xl font-bold mb-2">{points}</p>
        <p className="text-sm opacity-80">reward points</p>
        {redeemable > 0 && (
          <p className="mt-4 bg-white/20 rounded-lg px-4 py-2 inline-block text-sm font-medium">
            You can redeem ${redeemable * REDEEM_DISCOUNT} off at checkout!
          </p>
        )}
      </div>

      {/* Progress */}
      <div className="bg-white border rounded-xl p-6 mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">{progress} / {REDEEM_POINTS} points</span>
          <span className="text-gray-600">${REDEEM_DISCOUNT} reward</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-accent h-3 rounded-full transition-all"
            style={{ width: `${(progress / REDEEM_POINTS) * 100}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-3">
          Earn 1 point per $1 spent. Redeem {REDEEM_POINTS} points for ${REDEEM_DISCOUNT} off.
        </p>
      </div>

      {/* Transaction History */}
      <h2 className="text-lg font-semibold mb-4">History</h2>
      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No reward transactions yet. Start ordering to earn points!</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex justify-between items-center bg-white border rounded-lg p-4">
              <div>
                <p className="font-medium text-sm">{tx.description}</p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span className={`font-semibold ${tx.type === 'earned' ? 'text-accent' : 'text-primary'}`}>
                {tx.type === 'earned' ? '+' : '-'}{tx.points}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
