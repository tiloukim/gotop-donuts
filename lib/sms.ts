import { toE164 } from './phone';
import { ADMIN_SMS_PHONE } from './constants';

// Sends an SMS to the admin (Tilou Kim) when a new order comes in, using the
// Telnyx Messaging API. Requires TELNYX_API_KEY and a sending number in
// TELNYX_SMS_FROM (a Telnyx-provisioned number in E.164, e.g. "+19035550100").
// If either is missing it skips silently — new orders must never fail because
// the SMS alert isn't configured.
export async function sendNewOrderSms(
  orderNumber: number,
  orderType: string,
  total: number
) {
  const apiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_SMS_FROM;
  if (!apiKey || !from) {
    console.warn('[sms] Skipping new-order SMS — TELNYX_API_KEY or TELNYX_SMS_FROM not set');
    return;
  }

  const to = toE164(process.env.ADMIN_SMS_PHONE || ADMIN_SMS_PHONE);
  if (!to) {
    console.error('[sms] Invalid admin SMS phone number');
    return;
  }

  const text = `New Order #${orderNumber} — ${
    orderType === 'delivery' ? 'Delivery' : 'Pickup'
  } — $${total.toFixed(2)}`;

  try {
    const res = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, text }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[sms] Telnyx message error', res.status, detail);
    }
  } catch (err) {
    console.error('[sms] Failed to send new-order SMS', err);
  }
}
