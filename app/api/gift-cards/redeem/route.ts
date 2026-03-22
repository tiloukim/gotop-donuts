import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { code } = await request.json();

  if (!code) {
    return NextResponse.json({ error: 'Gift card code required' }, { status: 400 });
  }

  const svc = createServiceClient();
  const normalizedCode = code.toUpperCase().trim();

  const { data: card } = await svc
    .from('gift_cards')
    .select('id, balance, status')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (!card) {
    return NextResponse.json({ error: 'Gift card not found' }, { status: 404 });
  }

  if (card.status === 'disabled') {
    return NextResponse.json({ error: 'This gift card has been disabled' }, { status: 400 });
  }

  if (card.status === 'redeemed' || card.balance <= 0) {
    return NextResponse.json({ error: 'This gift card has no remaining balance' }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    balance: card.balance,
    code: normalizedCode,
  });
}
