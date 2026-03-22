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
  applePay: (paymentRequest: PaymentRequest) => Promise<DigitalWallet>;
  googlePay: (paymentRequest: PaymentRequest) => Promise<DigitalWallet>;
  paymentRequest: (config: PaymentRequestConfig) => PaymentRequest;
}

interface PaymentRequestConfig {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
}

interface PaymentRequest {
  update: (config: { total: { amount: string; label: string } }) => void;
}

interface Card {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<TokenResult>;
  destroy: () => void;
}

interface DigitalWallet {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<TokenResult>;
  destroy: () => void;
  addEventListener: (event: string, handler: (e: unknown) => void) => void;
}

interface TokenResult {
  status: string;
  token: string;
  errors?: { message: string }[];
}

interface SquarePaymentFormProps {
  onTokenize: (token: string) => void;
  onError: (error: string) => void;
  loading: boolean;
  total: number;
}

export default function SquarePaymentForm({ onTokenize, onError, loading, total }: SquarePaymentFormProps) {
  const cardRef = useRef<Card | null>(null);
  const applePayRef = useRef<DigitalWallet | null>(null);
  const googlePayRef = useRef<DigitalWallet | null>(null);
  const paymentRequestRef = useRef<PaymentRequest | null>(null);
  const initRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);

  // Update payment request amount when total changes
  useEffect(() => {
    if (paymentRequestRef.current) {
      paymentRequestRef.current.update({
        total: { amount: total.toFixed(2), label: 'GoTop Donuts' },
      });
    }
  }, [total]);

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

        // Initialize card payment
        const card = await payments.card();
        await card.attach('#card-container');
        cardRef.current = card;
        setReady(true);

        // Create payment request for Apple Pay / Google Pay
        const paymentRequest = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: total.toFixed(2), label: 'GoTop Donuts' },
        });
        paymentRequestRef.current = paymentRequest;

        // Initialize Apple Pay
        try {
          const applePay = await payments.applePay(paymentRequest);
          await applePay.attach('#apple-pay-container');
          setApplePayReady(true);
          applePayRef.current = applePay;
          console.log('[Payment] Apple Pay initialized successfully');
        } catch (appleErr) {
          console.log('[Payment] Apple Pay not available:', appleErr);
        }

        // Initialize Google Pay
        try {
          const googlePay = await payments.googlePay(paymentRequest);
          await googlePay.attach('#google-pay-container');
          setGooglePayReady(true);
          googlePayRef.current = googlePay;
          console.log('[Payment] Google Pay initialized successfully');
        } catch (googleErr) {
          console.log('[Payment] Google Pay not available:', googleErr);
        }
      } catch (e) {
        onError('Failed to initialize payment form');
      }
    }

    if (window.Square) {
      initSquare();
      return;
    }

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
      {/* Apple Pay / Google Pay buttons — containers must exist in DOM for SDK to attach */}
      <div id="apple-pay-container" className={applePayReady ? 'min-h-[48px]' : 'hidden'} />
      <div id="google-pay-container" className={googlePayReady ? 'min-h-[48px]' : 'hidden'} />
      {(applePayReady || googlePayReady) && (
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="flex-1 border-t border-gray-200" />
          <span>or pay with card</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
      )}

      {/* Card payment */}
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
