import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSquareClient } from '@/lib/square';
import { generateGiftCardCode } from '@/lib/gift-cards';
import { GIFT_CARD_MIN_CUSTOM, GIFT_CARD_MAX_CUSTOM } from '@/lib/constants';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { amount, sourceId, recipientName, recipientEmail, message } = body as {
    amount: number;
    sourceId: string;
    recipientName?: string;
    recipientEmail?: string;
    message?: string;
  };

  if (!amount || !sourceId) {
    return NextResponse.json({ error: 'Amount and payment source required' }, { status: 400 });
  }

  if (amount < GIFT_CARD_MIN_CUSTOM || amount > GIFT_CARD_MAX_CUSTOM) {
    return NextResponse.json({ error: `Amount must be between $${GIFT_CARD_MIN_CUSTOM} and $${GIFT_CARD_MAX_CUSTOM}` }, { status: 400 });
  }

  // Get user if logged in (optional for gift card purchase)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const square = getSquareClient();
    const locationId = process.env.SQUARE_LOCATION_ID!;

    // Process payment
    const paymentResult = await square.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(Math.round(amount * 100)),
        currency: 'USD',
      },
      locationId,
      note: `Gift Card Purchase - $${amount.toFixed(2)}`,
      referenceId: 'gotopdonuts-giftcard',
    });

    if (paymentResult.payment?.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    // Generate unique code
    const svc = createServiceClient();
    let code = '';
    let attempts = 0;

    while (attempts < 10) {
      code = generateGiftCardCode();
      const { data: existing } = await svc
        .from('gift_cards')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (!existing) break;
      attempts++;
    }

    if (!code) {
      return NextResponse.json({ error: 'Failed to generate gift card code' }, { status: 500 });
    }

    // Insert gift card
    const { data: giftCard, error: insertErr } = await svc
      .from('gift_cards')
      .insert({
        code,
        initial_amount: amount,
        balance: amount,
        purchaser_user_id: user?.id || null,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        message: message || null,
        square_payment_id: paymentResult.payment!.id!,
        status: 'active',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Gift card insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to create gift card' }, { status: 500 });
    }

    // Log purchase transaction
    await svc.from('gift_card_transactions').insert({
      gift_card_id: giftCard.id,
      type: 'purchase',
      amount,
      balance_after: amount,
    });

    return NextResponse.json({
      code,
      amount,
      id: giftCard.id,
    });
  } catch (err) {
    console.error('Gift card purchase error:', err);
    const message = err instanceof Error ? err.message : 'Purchase failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
