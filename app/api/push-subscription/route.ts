import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ADMIN_EMAIL } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Admin-only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { subscription } = await request.json();
  if (!subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        user_agent: request.headers.get('user-agent') || null,
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
  }

  const service = createServiceClient();
  await service
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}
