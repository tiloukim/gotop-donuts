'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { toE164 } from '@/lib/phone';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [phoneNum, setPhoneNum] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  // Phone verification (Telnyx) state
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);
  const router = useRouter();

  const phoneValid = !!toE164(phoneNum);

  async function sendCode() {
    setVerifyError('');
    setSendingCode(true);
    try {
      const res = await fetch('/api/verify/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNum }),
      });
      const data = await res.json();
      if (!res.ok) setVerifyError(data.error || 'Could not send code');
      else setCodeSent(true);
    } catch {
      setVerifyError('Could not send code');
    }
    setSendingCode(false);
  }

  async function verifyCode() {
    setVerifyError('');
    setVerifyingCode(true);
    try {
      const res = await fetch('/api/verify/check-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNum, code }),
      });
      const data = await res.json();
      if (res.ok && data.verified) setPhoneVerified(true);
      else setVerifyError(data.error || 'Incorrect code');
    } catch {
      setVerifyError('Could not verify code');
    }
    setVerifyingCode(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneVerified) {
      setError('Please verify your phone number before creating your account.');
      return;
    }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: phoneNum },
        captchaToken,
      },
    });

    // Reset turnstile after each attempt
    setCaptchaToken('');
    turnstileRef.current?.reset();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleSignup() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📧</div>
        <h1 className="text-2xl font-bold mb-2">Check your email</h1>
        <p className="text-gray-600">
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-center mb-8">Create Account</h1>

      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneNum}
              onChange={(e) => {
                setPhoneNum(e.target.value);
                setPhoneVerified(false);
                setCodeSent(false);
                setCode('');
                setVerifyError('');
              }}
              required
              readOnly={phoneVerified}
              placeholder="(903) 555-0199"
              className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-primary focus:border-transparent outline-none ${
                phoneVerified ? 'border-green-400 bg-green-50 text-gray-600' : 'border-gray-300'
              }`}
            />
            {!phoneVerified && (
              <button
                type="button"
                onClick={sendCode}
                disabled={!phoneValid || sendingCode}
                className="whitespace-nowrap bg-gray-800 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {sendingCode ? '...' : codeSent ? 'Resend' : 'Send Code'}
              </button>
            )}
          </div>

          {phoneVerified && (
            <p className="text-green-600 text-sm mt-1 font-medium">✓ Phone number verified</p>
          )}

          {codeSent && !phoneVerified && (
            <div className="mt-2">
              <p className="text-sm text-gray-500 mb-1">Enter the code we texted to your phone.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Verification code"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none tracking-widest"
                />
                <button
                  type="button"
                  onClick={verifyCode}
                  disabled={!code.trim() || verifyingCode}
                  className="whitespace-nowrap bg-primary text-white px-4 py-3 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50"
                >
                  {verifyingCode ? '...' : 'Verify'}
                </button>
              </div>
            </div>
          )}

          {verifyError && <p className="text-red-500 text-sm mt-1">{verifyError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>

        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={setCaptchaToken}
          onExpire={() => setCaptchaToken('')}
          options={{ theme: 'light', size: 'flexible' }}
        />

        <button
          type="submit"
          disabled={loading || !captchaToken || !phoneVerified}
          className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? 'Creating account...' : !phoneVerified ? 'Verify phone to continue' : 'Create Account'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <button
        onClick={handleGoogleSignup}
        className="w-full border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <p className="text-center mt-6 text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  );
}
