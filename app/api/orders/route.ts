import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSquareClient } from '@/lib/square';
import { sendOrderNotification } from '@/lib/email';
import { TX_SALES_TAX, POINTS_PER_DOLLAR, REDEEM_POINTS, REDEEM_DISCOUNT } from '@/lib/constants';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { CartItem, DeliveryAddress, OrderType } from '@/lib/types';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    items,
    orderType,
    deliveryAddress,
    deliveryFee,
    deliveryDistance,
    redeemPoints,
    sourceId,
    notes,
  } = body as {
    items: CartItem[];
    orderType: OrderType;
    deliveryAddress: DeliveryAddress | null;
    deliveryFee: number;
    deliveryDistance: number | null;
    redeemPoints: number;
    sourceId: string;
    notes: string;
  };

  if (!items?.length || !sourceId) {
    return NextResponse.json({ error: 'Items and payment source required' }, { status: 400 });
  }

  const service = createServiceClient();

  // Validate menu items against Square catalog
  const square = getSquareClient();
  const itemIds = items.map(i => i.menu_item_id);

  let menuMap = new Map<string, { name: string; price: number }>();
  try {
    const { objects } = await square.catalog.batchGet({
      objectIds: itemIds,
      includeRelatedObjects: false,
    });

    if (objects) {
      for (const obj of objects) {
        if (obj.type === 'ITEM' && obj.itemData) {
          const variation = obj.itemData.variations?.[0];
          const priceMoney = variation?.type === 'ITEM_VARIATION'
            ? variation.itemVariationData?.priceMoney
            : undefined;
          const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0;
          menuMap.set(obj.id, {
            name: obj.itemData.name || 'Unknown',
            price: priceCents / 100,
          });
        }
      }
    }
  } catch {
    // If Square is unreachable, fall back to cart prices
  }

  if (menuMap.size === 0 && items.length > 0) {
    // Fallback: trust cart data if Square fetch failed
    for (const item of items) {
      menuMap.set(item.menu_item_id, { name: item.name, price: item.price });
    }
  }

  let subtotal = 0;
  const orderItems = items.map(item => {
    const menu = menuMap.get(item.menu_item_id);
    const unitPrice = menu?.price || item.price;
    const totalPrice = unitPrice * item.quantity;
    subtotal += totalPrice;
    return {
      menu_item_id: item.menu_item_id,
      name: menu?.name || item.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      special_instructions: item.special_instructions || null,
    };
  });

  const tax = Math.round(subtotal * TX_SALES_TAX * 100) / 100;
  const actualDeliveryFee = orderType === 'delivery' ? deliveryFee : 0;

  // Calculate reward discount
  let discount = 0;
  let pointsRedeemed = 0;
  if (redeemPoints > 0) {
    const { data: profile } = await service
      .from('profiles')
      .select('reward_points')
      .eq('id', user.id)
      .single();

    if (profile && profile.reward_points >= REDEEM_POINTS) {
      const redeemCount = Math.min(
        Math.floor(redeemPoints / REDEEM_POINTS),
        Math.floor(profile.reward_points / REDEEM_POINTS)
      );
      pointsRedeemed = redeemCount * REDEEM_POINTS;
      discount = redeemCount * REDEEM_DISCOUNT;
    }
  }

  const total = Math.round((subtotal + tax + actualDeliveryFee - discount) * 100) / 100;
  const amountCents = Math.round(total * 100);

  // Process payment
  try {
    const square = getSquareClient();
    const paymentResult = await square.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID!,
    });

    if (paymentResult.payment?.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    const squarePaymentId = paymentResult.payment.id;

    // Create order
    const { data: order, error: orderError } = await service
      .from('orders')
      .insert({
        user_id: user.id,
        order_type: orderType,
        status: 'received',
        subtotal,
        tax,
        delivery_fee: actualDeliveryFee,
        discount,
        total,
        delivery_address: deliveryAddress,
        delivery_distance_miles: deliveryDistance,
        square_payment_id: squarePaymentId,
        points_earned: Math.floor(total) * POINTS_PER_DOLLAR,
        points_redeemed: pointsRedeemed,
        notes: notes || null,
        estimated_ready_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Insert order items
    await service.from('order_items').insert(
      orderItems.map(item => ({ ...item, order_id: order.id }))
    );

    // Update reward points
    const pointsEarned = Math.floor(total) * POINTS_PER_DOLLAR;
    const pointsChange = pointsEarned - pointsRedeemed;

    await service.rpc('update_reward_points', {
      p_user_id: user.id,
      p_points_change: pointsChange,
    });

    // Log reward transactions
    if (pointsEarned > 0) {
      const { data: updatedProfile } = await service
        .from('profiles')
        .select('reward_points')
        .eq('id', user.id)
        .single();

      await service.from('reward_transactions').insert([
        ...(pointsRedeemed > 0 ? [{
          user_id: user.id,
          order_id: order.id,
          type: 'redeemed' as const,
          points: pointsRedeemed,
          balance_after: (updatedProfile?.reward_points || 0) + pointsRedeemed,
          description: `Redeemed ${pointsRedeemed} points for $${discount.toFixed(2)} off`,
        }] : []),
        {
          user_id: user.id,
          order_id: order.id,
          type: 'earned' as const,
          points: pointsEarned,
          balance_after: updatedProfile?.reward_points || 0,
          description: `Earned ${pointsEarned} points on order #${order.order_number}`,
        },
      ]);
    }

    // Send notifications (non-blocking)
    const orderWithItems = { ...order, order_items: orderItems.map((item, i) => ({ ...item, id: `temp-${i}`, order_id: order.id })) };
    sendOrderNotification(orderWithItems).catch(console.error);

    // Push to Square POS (non-blocking)
    try {
      const squareOrderItems = orderItems.map(item => ({
        name: item.name,
        quantity: String(item.quantity),
        basePriceMoney: {
          amount: BigInt(Math.round(item.unit_price * 100)),
          currency: 'USD' as const,
        },
      }));

      await square.orders.create({
        order: {
          locationId: process.env.SQUARE_LOCATION_ID!,
          lineItems: squareOrderItems,
          state: 'OPEN',
        },
        idempotencyKey: randomUUID(),
      });
    } catch (e) {
      console.error('Square order push failed:', e);
    }

    return NextResponse.json({ order });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Order creation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
