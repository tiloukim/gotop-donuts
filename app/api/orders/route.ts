import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getSquareClient } from '@/lib/square';
import { sendOrderNotification } from '@/lib/email';
import { sendNewOrderPush } from '@/lib/push';
import { TX_SALES_TAX, POINTS_PER_DOLLAR, REDEEM_POINTS, REDEEM_DISCOUNT, SERVICE_FEE_RATE, SERVICE_FEE_FIXED } from '@/lib/constants';
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
    tip: tipAmount,
    scheduledAt,
    sourceId,
    notes,
    giftCardCode,
    giftCardAmount,
  } = body as {
    items: CartItem[];
    orderType: OrderType;
    deliveryAddress: DeliveryAddress | null;
    deliveryFee: number;
    deliveryDistance: number | null;
    redeemPoints: number;
    tip: number;
    scheduledAt: string | null;
    sourceId: string;
    notes: string;
    giftCardCode?: string;
    giftCardAmount?: number;
  };

  if (!items?.length || !sourceId) {
    return NextResponse.json({ error: 'Items and payment source required' }, { status: 400 });
  }

  const service = createServiceClient();

  // Validate menu items against Square catalog
  const square = getSquareClient();
  const itemIds = items.map(i => i.menu_item_id);

  let menuMap = new Map<string, { name: string; price: number; variationId: string | null }>();
  try {
    const { objects } = await square.catalog.batchGet({
      objectIds: itemIds,
      includeRelatedObjects: false,
    });

    if (objects) {
      for (const obj of objects) {
        if (obj.type === 'ITEM' && obj.itemData) {
          const variation = obj.itemData.variations?.[0];
          const variationId = variation?.id ?? null;
          const priceMoney = variation?.type === 'ITEM_VARIATION'
            ? variation.itemVariationData?.priceMoney
            : undefined;
          const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0;
          menuMap.set(obj.id, {
            name: obj.itemData.name || 'Unknown',
            price: priceCents / 100,
            variationId,
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
      menuMap.set(item.menu_item_id, { name: item.name, price: item.price, variationId: null });
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
      selected_variants: item.selectedVariants && Object.keys(item.selectedVariants).length > 0
        ? item.selectedVariants
        : null,
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

  const tip = tipAmount || 0;
  const beforeFee = subtotal + tax + actualDeliveryFee - discount + tip;
  const serviceFee = Math.round((beforeFee * SERVICE_FEE_RATE + SERVICE_FEE_FIXED) * 100) / 100;
  const total = Math.round((beforeFee + serviceFee) * 100) / 100;
  const amountCents = Math.round(total * 100);

  // Process payment
  try {
    const square = getSquareClient();
    const locationId = process.env.SQUARE_LOCATION_ID!;

    // 1. Create Square order FIRST so payment links to it (shows item names on POS)
    const squareOrderItems = orderItems.map(item => {
      const catalogInfo = menuMap.get(item.menu_item_id);
      const itemNote = [
        item.special_instructions || '',
        item.selected_variants ? Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ') : '',
      ].filter(Boolean).join(' | ') || undefined;

      if (catalogInfo?.variationId) {
        return {
          catalogObjectId: catalogInfo.variationId,
          quantity: String(item.quantity),
          ...(itemNote && { note: itemNote }),
        };
      }
      return {
        name: item.name,
        quantity: String(item.quantity),
        basePriceMoney: {
          amount: BigInt(Math.round(item.unit_price * 100)),
          currency: 'USD' as const,
        },
        ...(itemNote && { note: itemNote }),
      };
    });

    // Build service charges (delivery fee + tip) — not taxable
    const serviceCharges: { name: string; amountMoney: { amount: bigint; currency: 'USD' }; taxable: boolean }[] = [];
    if (actualDeliveryFee > 0) {
      serviceCharges.push({
        name: 'Delivery Fee',
        amountMoney: { amount: BigInt(Math.round(actualDeliveryFee * 100)), currency: 'USD' },
        taxable: false,
      });
    }
    if (tip > 0) {
      serviceCharges.push({
        name: 'Tip',
        amountMoney: { amount: BigInt(Math.round(tip * 100)), currency: 'USD' },
        taxable: false,
      });
    }
    if (serviceFee > 0) {
      serviceCharges.push({
        name: 'Online Order Fee',
        amountMoney: { amount: BigInt(Math.round(serviceFee * 100)), currency: 'USD' },
        taxable: false,
      });
    }

    let squareOrderId: string | undefined;
    let squareOrderTotal: bigint | undefined;

    try {
      const fulfillmentType = orderType === 'delivery' ? 'DELIVERY' : 'PICKUP';
      const displayName = user.user_metadata?.full_name || user.email || 'Online Customer';

      // Build receipt note for fulfillment
      const receiptParts = ['www.gotopdonuts.com Online Order']
      if (scheduledAt) {
        const schedDate = new Date(scheduledAt)
        const dateStr = schedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        const timeStr = schedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        receiptParts.push(`${orderType === 'pickup' ? 'Pickup' : 'Delivery'}: ${dateStr} at ${timeStr}`)
      } else {
        receiptParts.push(`${orderType === 'pickup' ? 'Pickup' : 'Delivery'}: ASAP`)
      }
      if (notes) receiptParts.push(`Note: ${notes}`)
      const fulfillmentNote = receiptParts.join(' | ')

      // Build fulfillment based on order type
      const fulfillment: Record<string, unknown> = {
        type: fulfillmentType,
        state: 'PROPOSED',
      };

      if (fulfillmentType === 'PICKUP') {
        fulfillment.pickupDetails = {
          recipient: {
            displayName,
            emailAddress: user.email,
          },
          pickupAt: scheduledAt || new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          note: fulfillmentNote,
        };
      } else {
        fulfillment.deliveryDetails = {
          recipient: {
            displayName,
            emailAddress: user.email,
            address: deliveryAddress ? {
              addressLine1: deliveryAddress.street,
              locality: deliveryAddress.city,
              administrativeDistrictLevel1: deliveryAddress.state,
              postalCode: deliveryAddress.zip,
            } : undefined,
          },
          note: fulfillmentNote,
        };
      }

      const { order: squareOrder } = await square.orders.create({
        order: {
          locationId,
          referenceId: 'gotopdonuts.com',
          lineItems: squareOrderItems,
          taxes: [{
            name: 'Sales Tax',
            percentage: String(TX_SALES_TAX * 100),
            scope: 'ORDER' as const,
          }],
          ...(serviceCharges.length > 0 && { serviceCharges }),
          ...(discount > 0 && {
            discounts: [{
              name: 'Rewards Discount',
              amountMoney: {
                amount: BigInt(Math.round(discount * 100)),
                currency: 'USD' as const,
              },
              scope: 'ORDER' as const,
            }],
          }),
          fulfillments: [fulfillment],
        },
        idempotencyKey: randomUUID(),
      });

      squareOrderId = squareOrder?.id;
      squareOrderTotal = squareOrder?.totalMoney?.amount
        ? BigInt(squareOrder.totalMoney.amount)
        : undefined;
    } catch (orderErr) {
      console.error('Square order creation failed:', orderErr);
      // Fall back to payment without order (items won't show on POS but payment works)
    }

    // Use Square's computed total if available (avoids rounding mismatch), else our calculated total
    const paymentAmount = squareOrderTotal ?? BigInt(amountCents);

    // 2. Create payment linked to the Square order
    const paymentResult = await square.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: paymentAmount,
        currency: 'USD',
      },
      locationId,
      ...(squareOrderId && { orderId: squareOrderId }),
    });

    if (paymentResult.payment?.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    const squarePaymentId = paymentResult.payment.id;

    // Use Square's total if available (matches actual charge)
    const actualTotal = squareOrderTotal
      ? Number(squareOrderTotal) / 100
      : total;

    // 3. Create DB order
    const { data: order, error: orderError } = await service
      .from('orders')
      .insert({
        user_id: user.id,
        order_type: orderType,
        status: 'received',
        subtotal,
        tax,
        delivery_fee: actualDeliveryFee,
        service_fee: serviceFee,
        discount,
        tip,
        total: actualTotal,
        delivery_address: deliveryAddress,
        delivery_distance_miles: deliveryDistance,
        square_payment_id: squarePaymentId,
        square_order_id: squareOrderId || null,
        points_earned: Math.floor(actualTotal) * POINTS_PER_DOLLAR,
        points_redeemed: pointsRedeemed,
        notes: notes || null,
        scheduled_at: scheduledAt || null,
        estimated_ready_at: scheduledAt
          ? scheduledAt
          : new Date(Date.now() + 20 * 60 * 1000).toISOString(),
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
    const pointsEarned = Math.floor(actualTotal) * POINTS_PER_DOLLAR;
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

    // Deduct gift card balance if used
    if (giftCardCode && giftCardAmount && giftCardAmount > 0) {
      try {
        const { data: card } = await service
          .from('gift_cards')
          .select('id, balance')
          .eq('code', giftCardCode.toUpperCase().trim())
          .single();

        if (card && card.balance >= giftCardAmount) {
          const newBalance = Math.round((card.balance - giftCardAmount) * 100) / 100;
          await service
            .from('gift_cards')
            .update({
              balance: newBalance,
              ...(newBalance <= 0 && { status: 'redeemed' }),
            })
            .eq('id', card.id);

          await service.from('gift_card_transactions').insert({
            gift_card_id: card.id,
            order_id: order.id,
            type: 'redemption',
            amount: giftCardAmount,
            balance_after: newBalance,
          });
        }
      } catch (gcErr) {
        console.error('Gift card deduction error:', gcErr);
      }
    }

    // Send notifications (non-blocking)
    const orderWithItems = { ...order, order_items: orderItems.map((item, i) => ({ ...item, id: `temp-${i}`, order_id: order.id })) };
    sendOrderNotification(orderWithItems).catch(console.error);
    sendNewOrderPush(order.order_number, orderType, actualTotal).catch(console.error);

    return NextResponse.json({ order });
  } catch (err: unknown) {
    console.error('Order/payment failed:', JSON.stringify(err, Object.getOwnPropertyNames(err as object), 2));

    // Parse Square API errors into friendly messages
    let message = 'Payment failed. Please try again.';
    // Square SDK v44 wraps errors — check both top-level and nested
    const sqErrors: { code?: string; detail?: string }[] = [];
    if (err && typeof err === 'object') {
      if ('errors' in err) {
        const e = err as { errors?: { code?: string; detail?: string }[] };
        sqErrors.push(...(e.errors || []));
      }
      if ('body' in err) {
        const e = err as { body?: { errors?: { code?: string; detail?: string }[] } };
        sqErrors.push(...(e.body?.errors || []));
      }
    }
    if (sqErrors.length > 0) {
      const codes = sqErrors.map(e => e.code) ?? [];
      if (codes.includes('CVV_FAILURE')) {
        message = 'Card declined — incorrect CVV. Please check your card details.';
      } else if (codes.includes('TRANSACTION_LIMIT')) {
        message = 'Card declined — transaction limit exceeded. Please try a different card.';
      } else if (codes.includes('CARD_DECLINED') || codes.includes('GENERIC_DECLINE')) {
        message = 'Card declined. Please try a different card.';
      } else if (codes.includes('INSUFFICIENT_FUNDS')) {
        message = 'Card declined — insufficient funds.';
      } else if (codes.includes('CARD_EXPIRED')) {
        message = 'Card expired. Please use a different card.';
      } else if (codes.includes('INVALID_CARD')) {
        message = 'Invalid card number. Please check and try again.';
      } else if (codes.includes('ADDRESS_VERIFICATION_FAILURE')) {
        message = 'Address verification failed. Please check your billing address.';
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
