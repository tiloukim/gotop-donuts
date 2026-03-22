'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    Square: {
      payments: (appId: string, locationId: string) => Promise<any>;
    };
  }
}

interface SquarePaymentFormProps {
  onTokenize: (token: string) => void;
  onError: (error: string) => void;
  loading: boolean;
  total: number;
}

export default function SquarePaymentForm({ onTokenize, onError, loading, total }: SquarePaymentFormProps) {
  const cardRef = useRef<any>(null);
  const applePayButtonRef = useRef<any>(null);
  const paymentRequestRef = useRef<any>(null);
  const onTokenizeRef = useRef(onTokenize);
  const onErrorRef = useRef(onError);
  const initRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  // Keep refs updated
  onTokenizeRef.current = onTokenize;
  onErrorRef.current = onError;

  // Update payment request amount when total changes
  useEffect(() => {
    if (paymentRequestRef.current && total > 0) {
      try {
        paymentRequestRef.current.update({
          total: { amount: total.toFixed(2), label: 'GoTop Donuts' },
        });
      } catch {
        // ignore update errors
      }
    }
  }, [total]);

  const handleDigitalWalletToken = useCallback(async (wallet: any) => {
    try {
      const result = await wallet.tokenize();
      if (result.status === 'OK') {
        onTokenizeRef.current(result.token);
      } else {
        onErrorRef.current(result.errors?.[0]?.message || 'Payment failed');
      }
    } catch {
      onErrorRef.current('Payment processing failed');
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID!;
    const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!;

    async function initSquare() {
      if (!window.Square) {
        onErrorRef.current('Square SDK not loaded');
        return;
      }

      try {
        const payments = await window.Square.payments(appId, locationId);

        // Initialize card payment
        const card = await payments.card();
        await card.attach('#card-container');
        cardRef.current = card;
        setReady(true);

        // Use a minimum amount for initialization, will be updated via useEffect
        const initAmount = total > 0 ? total.toFixed(2) : '1.00';

        // Create payment request for Apple Pay / Google Pay
        const paymentRequest = payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: initAmount, label: 'GoTop Donuts' },
        });
        paymentRequestRef.current = paymentRequest;

        // Initialize Apple Pay
        try {
          const applePayResult = await payments.applePay(paymentRequest);
          if (applePayResult) {
            // Square SDK v2: applePay may return an object with attach or be the button itself
            if (typeof applePayResult.attach === 'function') {
              await applePayResult.attach('#apple-pay-container');
            }
            applePayButtonRef.current = applePayResult;
            setApplePayReady(true);
            setDebugInfo(prev => prev + ' | Apple Pay: ready');
            console.log('[Payment] Apple Pay ready');
          }
        } catch (e: any) {
          setDebugInfo(prev => prev + ' | Apple Pay error: ' + (e?.message || String(e)));
          console.log('[Payment] Apple Pay not available:', e?.message || e);
        }

        // Initialize Google Pay
        try {
          const googlePay = await payments.googlePay(paymentRequest);
          await googlePay.attach('#google-pay-container');
          setGooglePayReady(true);
          setDebugInfo(prev => prev + ' | Google Pay: ready');
          console.log('[Payment] Google Pay ready');
        } catch (e: any) {
          setDebugInfo(prev => prev + ' | Google Pay error: ' + (e?.message || String(e)));
          console.log('[Payment] Google Pay not available:', e?.message || e);
        }
      } catch (e) {
        onErrorRef.current('Failed to initialize payment form');
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
    script.onerror = () => onErrorRef.current('Failed to load payment SDK');
    document.head.appendChild(script);
  }, [total, handleDigitalWalletToken]);

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
      {/* Debug info — remove after testing */}
      {debugInfo && (
        <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded break-all">{debugInfo}</p>
      )}

      {/* Apple Pay / Google Pay — containers must exist in DOM for SDK to attach */}
      {applePayReady && (
        <button
          id="apple-pay-container"
          onClick={async () => {
            if (!applePayButtonRef.current) return;
            try {
              const result = await applePayButtonRef.current.tokenize();
              if (result.status === 'OK') {
                onTokenizeRef.current(result.token);
              } else {
                onErrorRef.current(result.errors?.[0]?.message || 'Apple Pay failed');
              }
            } catch (e: any) {
              onErrorRef.current(e?.message || 'Apple Pay failed');
            }
          }}
          disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white disabled:opacity-50"
          style={{ background: '#000', minHeight: 48, fontSize: 16, WebkitAppearance: 'none' }}
        >
           Pay with Apple Pay
        </button>
      )}
      {!applePayReady && <div id="apple-pay-container" className="hidden" />}
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
