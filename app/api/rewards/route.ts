import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();

  const [profileResult, transactionsResult] = await Promise.all([
    service.from('profiles').select('reward_points').eq('id', user.id).single(),
    service.from('reward_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    points: profileResult.data?.reward_points || 0,
    transactions: transactionsResult.data || [],
  });
}
