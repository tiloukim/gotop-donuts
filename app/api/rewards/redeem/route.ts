import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { REDEEM_POINTS, REDEEM_DISCOUNT } from '@/lib/constants';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('reward_points')
    .eq('id', user.id)
    .single();

  if (!profile || profile.reward_points < REDEEM_POINTS) {
    return NextResponse.json({ error: `Need at least ${REDEEM_POINTS} points` }, { status: 400 });
  }

  return NextResponse.json({
    canRedeem: true,
    points: profile.reward_points,
    redeemableCount: Math.floor(profile.reward_points / REDEEM_POINTS),
    discountPerRedeem: REDEEM_DISCOUNT,
  });
}
