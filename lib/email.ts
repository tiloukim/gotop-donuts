import { Resend } from 'resend';
import { NOTIFICATION_EMAIL, STORE_NAME, STATUS_LABELS } from './constants';
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

export async function sendOrderStatusEmail(
  customerEmail: string,
  order: Order & { order_items?: OrderItem[] }
) {
  const resend = getResend();

  await resend.emails.send({
    from: `${STORE_NAME} <onboarding@resend.dev>`,
    to: customerEmail,
    subject: `Order #${order.order_number} — ${STATUS_LABELS[order.status]}`,
    text: `Your order #${order.order_number} status has been updated to: ${STATUS_LABELS[order.status]}.

Thank you for choosing ${STORE_NAME}!`,
  });
}

// Type imports needed for the status email function
import type { Order, OrderItem } from './types';
