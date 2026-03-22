'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { GiftCardTransaction } from '@/lib/types';

export default function GiftCardBalancePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    code: string;
    initial_amount: number;
    balance: number;
    status: string;
    created_at: string;
    transactions: GiftCardTransaction[];
  } | null>(null);

  async function checkBalance() {
    if (!code.trim()) {
      setError('Please enter a gift card code');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/gift-cards/balance?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gift card not found');
      } else {
        setResult(data);
      }
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Check Gift Card Balance</h1>
      <p className="text-gray-500 mb-8">Enter your gift card code below</p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      <div className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="GTOP-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && checkBalance()}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono text-lg tracking-wider"
          maxLength={14}
        />
        <button
          onClick={checkBalance}
          disabled={loading}
          className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? '...' : 'Check'}
        </button>
      </div>

      {result && (
        <div>
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 text-white mb-6">
            <p className="text-sm opacity-80 mb-1">Gift Card Balance</p>
            <p className="text-4xl font-bold mb-1">${result.balance.toFixed(2)}</p>
            <p className="text-sm opacity-70">
              of ${result.initial_amount.toFixed(2)} original value
            </p>
            <p className="text-xs opacity-60 mt-3 font-mono">{result.code}</p>
            {result.status !== 'active' && (
              <p className="mt-2 bg-white/20 rounded px-3 py-1 inline-block text-sm capitalize">
                {result.status}
              </p>
            )}
          </div>

          {/* Transaction History */}
          {result.transactions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Transaction History</h2>
              <div className="space-y-2">
                {result.transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center bg-white border rounded-lg p-4">
                    <div>
                      <p className="font-medium text-sm capitalize">{tx.type}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: 'numeric', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`font-semibold ${tx.type === 'purchase' ? 'text-accent' : 'text-primary'}`}>
                        {tx.type === 'purchase' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </span>
                      <p className="text-xs text-gray-400">Bal: ${tx.balance_after.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/gift-cards" className="text-primary hover:underline text-sm font-medium">
          Buy a gift card
        </Link>
      </div>
    </div>
  );
}
