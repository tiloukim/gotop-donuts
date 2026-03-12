import webpush from 'web-push';
import { createServiceClient } from './supabase/service';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys not configured');
  }
  webpush.setVapidDetails(
    'mailto:' + (process.env.ADMIN_EMAIL || 'tiloukim@gmail.com'),
    publicKey,
    privateKey
  );
  vapidConfigured = true;
}

export async function sendNewOrderPush(
  orderNumber: number,
  orderType: string,
  total: number
) {
  try {
    ensureVapid();
  } catch {
    // VAPID keys not set — skip push silently
    return;
  }

  const service = createServiceClient();
  const { data: subs } = await service
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth');

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: `New Order #${orderNumber}`,
    body: `${orderType === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'} — $${total.toFixed(2)}`,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload
      )
    )
  );

  // Clean up expired subscriptions (410 Gone)
  const expiredIds: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === 'rejected' &&
      (result.reason as { statusCode?: number })?.statusCode === 410
    ) {
      expiredIds.push(subs[i].id);
    }
  });

  if (expiredIds.length > 0) {
    await service
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds);
  }
}
