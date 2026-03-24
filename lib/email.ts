import { Resend } from 'resend';
import { NOTIFICATION_EMAIL, STORE_NAME, STORE_ADDRESS, STORE_PHONE, STATUS_LABELS } from './constants';
import type { OrderWithItems } from './types';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function sendOrderNotification(order: OrderWithItems) {
  const resend = getResend();

  const itemsList = order.order_items
    .map(item => `• ${item.quantity}x ${item.name} — $${item.total_price.toFixed(2)}`)
    .join('\n');

  await resend.emails.send({
    from: `${STORE_NAME} <onboarding@resend.dev>`,
    to: NOTIFICATION_EMAIL,
    subject: `New Order #${order.order_number} — ${order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}`,
    text: `
New ${order.order_type} order received!

Order #${order.order_number}
Type: ${order.order_type}

Items:
${itemsList}

Subtotal: $${order.subtotal.toFixed(2)}
Tax: $${order.tax.toFixed(2)}
${order.delivery_fee > 0 ? `Delivery Fee: $${order.delivery_fee.toFixed(2)}\n` : ''}${order.discount > 0 ? `Discount: -$${order.discount.toFixed(2)}\n` : ''}Total: $${order.total.toFixed(2)}

${order.delivery_address ? `Delivery Address: ${order.delivery_address.street}, ${order.delivery_address.city}, ${order.delivery_address.state} ${order.delivery_address.zip}` : ''}
${order.notes ? `Notes: ${order.notes}` : ''}
    `.trim(),
  });
}

const STATUS_MESSAGES: Record<string, { subject: string; body: string }> = {
  preparing: {
    subject: 'Your order is being prepared!',
    body: `Great news! We've started preparing your order. It will be ready soon.`,
  },
  ready: {
    subject: 'Your order is ready for pickup!',
    body: `Your order is ready and waiting for you! Please come pick it up at your earliest convenience.\n\n📍 ${STORE_ADDRESS}`,
  },
  out_for_delivery: {
    subject: 'Your order is on the way!',
    body: `Your order is out for delivery! Our driver is headed your way. You can track your delivery on your order page.`,
  },
  delivered: {
    subject: 'Your order has been delivered!',
    body: `Your order has been delivered. Enjoy your donuts! 🍩\n\nWe'd love to hear how everything was — you can leave a review on your order page.`,
  },
  picked_up: {
    subject: 'Thank you for picking up your order!',
    body: `Your order has been picked up. Enjoy your donuts! 🍩\n\nWe'd love to hear how everything was — you can leave a review on your order page.`,
  },
  cancelled: {
    subject: 'Your order has been cancelled',
    body: `Your order has been cancelled. If a refund was issued, it will appear on your original payment method within 5-10 business days.\n\nIf you have any questions, please call us at ${STORE_PHONE}.`,
  },
  refunded: {
    subject: 'Your order has been refunded',
    body: `Your order has been refunded. The refund will appear on your original payment method within 5-10 business days.\n\nIf you have any questions, please call us at ${STORE_PHONE}.`,
  },
};

export async function sendOrderStatusEmail(
  customerEmail: string,
  order: { order_number: number; status: string },
  orderUrl: string
) {
  const resend = getResend();
  const msg = STATUS_MESSAGES[order.status];
  if (!msg) return;

  await resend.emails.send({
    from: `${STORE_NAME} <onboarding@resend.dev>`,
    to: customerEmail,
    subject: `Order #${order.order_number} — ${msg.subject}`,
    text: `Hi there!\n\n${msg.body}\n\nOrder #${order.order_number}\nStatus: ${STATUS_LABELS[order.status]}\n\nView your order: ${orderUrl}\n\nThank you for choosing ${STORE_NAME}!\n${STORE_ADDRESS}\n${STORE_PHONE}`,
  });
}
