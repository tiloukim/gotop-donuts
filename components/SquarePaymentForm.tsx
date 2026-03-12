'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Square: {
      payments: (appId: string, locationId: string) => Promise<Payments>;
    };
  }
}

interface Payments {
  card: () => Promise<Card>;
}

interface Card {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token: string; errors?: { message: string }[] }>;
  destroy: () => void;
}

interface SquarePaymentFormProps {
  onTokenize: (token: string) => void;
  onError: (error: string) => void;
  loading: boolean;
  total: number;
}

export default function SquarePaymentForm({ onTokenize, onError, loading, total }: SquarePaymentFormProps) {
  const cardRef = useRef<Card | null>(null);
  const initRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!;

    async function initSquare() {
      if (!window.Square) {
        onError('Square SDK not loaded');
        return;
      }

      try {
        const payments = await window.Square.payments(appId, locationId);
        const card = await payments.card();
        await card.attach('#card-container');
        cardRef.current = card;
        setReady(true);
      } catch (e) {
        onError('Failed to initialize payment form');
      }
    }

    // Check if SDK already loaded
    if (window.Square) {
      initSquare();
      return;
    }

    // Check if script already exists
    if (document.querySelector('script[src*="square.js"]')) {
      const check = setInterval(() => {
        if (window.Square) {
          clearInterval(check);
          initSquare();
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    const isProduction = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === 'production';
    script.src = isProduction
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';
    script.onload = initSquare;
    script.onerror = () => onError('Failed to load payment SDK');
    document.head.appendChild(script);
  }, []);

  async function handlePay() {
    if (!cardRef.current) return;

    try {
      const result = await cardRef.current.tokenize();
      if (result.status === 'OK') {
        onTokenize(result.token);
      } else {
        onError(result.errors?.[0]?.message || 'Card tokenization failed');
      }
    } catch {
      onError('Payment processing failed');
    }
  }

  return (
    <div className="space-y-4">
      <div id="card-container" className="min-h-[90px]" />
      <button
        onClick={handlePay}
        disabled={!ready || loading}
        className="w-full bg-primary text-white py-4 rounded-lg font-bold text-lg hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? 'Processing...' : `Pay $${total.toFixed(2)}`}
      </button>
    </div>
  );
}
