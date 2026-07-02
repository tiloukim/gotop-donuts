import { NextRequest, NextResponse } from 'next/server';
import { toE164 } from '@/lib/phone';

// Sends an SMS verification code via the Telnyx Verify API.
export async function POST(request: NextRequest) {
  const apiKey = process.env.TELNYX_API_KEY;
  const verifyProfileId = process.env.TELNYX_VERIFY_PROFILE_ID;
  if (!apiKey || !verifyProfileId) {
    return NextResponse.json({ error: 'Phone verification is not configured' }, { status: 500 });
  }

  const { phone } = (await request.json()) as { phone?: string };
  const phoneNumber = toE164(phone || '');
  if (!phoneNumber) {
    return NextResponse.json({ error: 'Enter a valid 10-digit phone number' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.telnyx.com/v2/verifications/sms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_number: phoneNumber, verify_profile_id: verifyProfileId }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[verify/send-code] Telnyx error', res.status, detail);
      return NextResponse.json({ error: 'Could not send verification code. Try again.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[verify/send-code] failed', err);
    return NextResponse.json({ error: 'Could not send verification code. Try again.' }, { status: 502 });
  }
}
