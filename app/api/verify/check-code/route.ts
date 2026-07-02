import { NextRequest, NextResponse } from 'next/server';
import { toE164 } from '@/lib/phone';

// Verifies an SMS code against the Telnyx Verify API.
export async function POST(request: NextRequest) {
  const apiKey = process.env.TELNYX_API_KEY;
  const verifyProfileId = process.env.TELNYX_VERIFY_PROFILE_ID;
  if (!apiKey || !verifyProfileId) {
    return NextResponse.json({ error: 'Phone verification is not configured' }, { status: 500 });
  }

  const { phone, code } = (await request.json()) as { phone?: string; code?: string };
  const phoneNumber = toE164(phone || '');
  const cleanCode = (code || '').replace(/\D/g, '');
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 });
  }
  if (!cleanCode) {
    return NextResponse.json({ error: 'Enter the verification code' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/verifications/by_phone_number/${encodeURIComponent(phoneNumber)}/actions/verify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: cleanCode, verify_profile_id: verifyProfileId }),
      }
    );

    const data = await res.json().catch(() => null);
    const responseCode = data?.data?.response_code;

    if (res.ok && responseCode === 'accepted') {
      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false, error: 'Incorrect or expired code' }, { status: 400 });
  } catch (err) {
    console.error('[verify/check-code] failed', err);
    return NextResponse.json({ error: 'Could not verify code. Try again.' }, { status: 502 });
  }
}
