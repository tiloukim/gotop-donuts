'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GIFT_CARD_AMOUNTS, GIFT_CARD_MIN_CUSTOM, GIFT_CARD_MAX_CUSTOM, STORE_NAME } from '@/lib/constants';

const SquarePaymentForm = dynamic(() => import('@/components/SquarePaymentForm'), { ssr: false });

export default function GiftCardsPage() {
  const [amount, setAmount] = useState<number>(25);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [purchasedCode, setPurchasedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const effectiveAmount = isCustom ? parseFloat(customAmount) || 0 : amount;

  async function handleTokenize(sourceId: string) {
    if (effectiveAmount < GIFT_CARD_MIN_CUSTOM) {
      setError(`Minimum amount is $${GIFT_CARD_MIN_CUSTOM}`);
      return;
    }
    if (effectiveAmount > GIFT_CARD_MAX_CUSTOM) {
      setError(`Maximum amount is $${GIFT_CARD_MAX_CUSTOM}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/gift-cards/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          sourceId,
          recipientName: recipientName || undefined,
          recipientEmail: recipientEmail || undefined,
          message: message || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Purchase failed');
        setLoading(false);
        return;
      }

      setPurchasedCode(data.code);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  function copyCode() {
    navigator.clipboard.writeText(purchasedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Success state
  if (purchasedCode) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold mb-2">Gift Card Purchased!</h1>
        <p className="text-gray-500 mb-8">${effectiveAmount.toFixed(2)} gift card is ready to use</p>

        <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-8 text-white mb-6">
          <p className="text-sm opacity-80 mb-2">{STORE_NAME} Gift Card</p>
          <p className="text-4xl font-bold tracking-wider mb-3">{purchasedCode}</p>
          <p className="text-2xl font-semibold">${effectiveAmount.toFixed(2)}</p>
        </div>

        <button
          onClick={copyCode}
          className="bg-gray-800 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 mb-4"
        >
          {copied ? 'Copied!' : 'Copy Code'}
        </button>

        {recipientName && (
          <p className="text-sm text-gray-500 mt-4">
            For: {recipientName} {recipientEmail && `(${recipientEmail})`}
          </p>
        )}

        <div className="flex gap-3 justify-center mt-8">
          <Link href="/gift-cards" onClick={() => { setPurchasedCode(''); setLoading(false); }} className="text-primary hover:underline font-medium">
            Buy Another
          </Link>
          <Link href="/menu" className="text-primary hover:underline font-medium">
            Browse Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Gift Cards</h1>
      <p className="text-gray-500 mb-8">Give the gift of fresh donuts & breakfast!</p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      {/* Amount Selection */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Select Amount</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {GIFT_CARD_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => { setAmount(a); setIsCustom(false); }}
              className={`py-3 rounded-lg font-semibold border-2 transition-colors ${
                !isCustom && amount === a
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              ${a}
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsCustom(true)}
          className={`w-full py-3 rounded-lg font-medium border-2 transition-colors mb-2 ${
            isCustom
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          Custom Amount
        </button>
        {isCustom && (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
            <input
              type="number"
              min={GIFT_CARD_MIN_CUSTOM}
              max={GIFT_CARD_MAX_CUSTOM}
              step="0.01"
              placeholder={`${GIFT_CARD_MIN_CUSTOM} - ${GIFT_CARD_MAX_CUSTOM}`}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              autoFocus
            />
          </div>
        )}
      </section>

      {/* Recipient (Optional) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Send as a Gift</h2>
        <p className="text-sm text-gray-400 mb-3">Optional — leave blank to keep for yourself</p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Recipient name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          <input
            type="email"
            placeholder="Recipient email (optional)"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
          <textarea
            placeholder="Add a personal message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
          />
        </div>
      </section>

      {/* Summary */}
      <section className="mb-8">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between font-bold text-lg">
            <span>Gift Card Total</span>
            <span>${effectiveAmount > 0 ? effectiveAmount.toFixed(2) : '0.00'}</span>
          </div>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Payment</h2>
        {effectiveAmount >= GIFT_CARD_MIN_CUSTOM ? (
          <SquarePaymentForm
            onTokenize={handleTokenize}
            onError={(msg) => setError(msg)}
            loading={loading}
            total={effectiveAmount}
          />
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            Select an amount to continue
          </p>
        )}
      </section>

      {/* Check Balance Link */}
      <div className="text-center mt-8">
        <Link href="/gift-cards/balance" className="text-primary hover:underline text-sm font-medium">
          Have a gift card? Check your balance
        </Link>
      </div>
    </div>
  );
}
