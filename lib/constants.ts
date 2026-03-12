export const STORE_NAME = 'GoTop Donuts';
export const STORE_ADDRESS = '7205 S Broadway Ave. #400, Tyler, TX 75703';
export const STORE_PHONE = '(903) 345-5598';
export const STORE_EMAIL = 'hello@gotopdonuts.com';
export const ADMIN_EMAIL = 'tiloukim@gmail.com';
export const NOTIFICATION_EMAIL = 'topdonuts903@gmail.com';

// Store coordinates (Tyler, TX)
export const STORE_LAT = 32.2711;
export const STORE_LNG = -95.3071;

// Delivery fee tiers
export const DELIVERY_TIERS = [
  { maxMiles: 3, fee: 2.99 },
  { maxMiles: 5, fee: 4.99 },
  { maxMiles: 8, fee: 6.99 },
] as const;

export const MAX_DELIVERY_MILES = 8;

// Tax rate
export const TX_SALES_TAX = 0.0825;

// Rewards
export const POINTS_PER_DOLLAR = 1;
export const REDEEM_POINTS = 100;
export const REDEEM_DISCOUNT = 5;

// Store hours
export const STORE_HOURS = {
  open: '4:30 AM',
  close: '12:30 PM',
  days: 'Monday - Sunday',
  closed: '',
};

// Order status labels
export const STATUS_LABELS: Record<string, string> = {
  received: 'Order Received',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  picked_up: 'Picked Up',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};
