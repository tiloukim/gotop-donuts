export type OrderType = 'pickup' | 'delivery';
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'picked_up';
export type MenuCategory = 'breakfast' | 'donuts' | 'drinks';
export type RewardType = 'earned' | 'redeemed';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  reward_points: number;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  category: MenuCategory;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: number;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  discount: number;
  total: number;
  delivery_address: DeliveryAddress | null;
  delivery_distance_miles: number | null;
  square_payment_id: string | null;
  square_order_id: string | null;
  points_earned: number;
  points_redeemed: number;
  notes: string | null;
  estimated_ready_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions: string | null;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
}

export interface RewardTransaction {
  id: string;
  user_id: string;
  order_id: string | null;
  type: RewardType;
  points: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  special_instructions: string;
  image_url: string | null;
}
