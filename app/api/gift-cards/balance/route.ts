import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.toUpperCase().trim();

  if (!code) {
    return NextResponse.json({ error: 'Gift card code required' }, { status: 400 });
  }

  const svc = createServiceClient();

  const { data: card } = await svc
    .from('gift_cards')
    .select('id, code, initial_amount, balance, status, created_at')
    .eq('code', code)
    .maybeSingle();

  if (!card) {
    return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
  }

  const { data: transactions } = await svc
    .from('gift_card_transactions')
    .select('*')
    .eq('gift_card_id', card.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    code: card.code,
    initial_amount: card.initial_amount,
    balance: card.balance,
    status: card.status,
    created_at: card.created_at,
    transactions: transactions || [],
  });
}
