import { getSquareClient } from '@/lib/square';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const { sourceId, amountCents, orderId } = await request.json();

  if (!sourceId || !amountCents) {
    return NextResponse.json({ error: 'sourceId and amountCents required' }, { status: 400 });
  }

  try {
    const client = getSquareClient();
    const response = await client.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID!,
      note: `GoTop Donuts Order ${orderId || ''}`.trim(),
    });

    return NextResponse.json({
      paymentId: response.payment?.id,
      status: response.payment?.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
