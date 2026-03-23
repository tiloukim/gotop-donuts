-- GoTop Donuts — Supabase Schema
-- Run this in your Supabase SQL Editor

-- Profiles table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  reward_points integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Addresses table
create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  label text default 'Home',
  street text not null,
  city text not null,
  state text default 'TX',
  zip text not null,
  lat double precision,
  lng double precision,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Menu items table
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('breakfast', 'donuts', 'drinks')),
  name text not null,
  description text not null default '',
  price numeric(8,2) not null,
  image_url text,
  is_available boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Orders table
create sequence if not exists order_number_seq start 1001;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  order_number integer default nextval('order_number_seq'),
  order_type text not null check (order_type in ('pickup', 'delivery')),
  status text not null default 'received' check (status in ('received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up')),
  subtotal numeric(8,2) not null,
  tax numeric(8,2) not null,
  delivery_fee numeric(8,2) default 0,
  service_fee numeric(8,2) default 0,
  discount numeric(8,2) default 0,
  total numeric(8,2) not null,
  delivery_address jsonb,
  delivery_distance_miles numeric(4,1),
  square_payment_id text,
  square_order_id text,
  points_earned integer default 0,
  points_redeemed integer default 0,
  notes text,
  estimated_ready_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Order items table
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  menu_item_id uuid references menu_items(id),
  name text not null,
  quantity integer not null default 1,
  unit_price numeric(8,2) not null,
  total_price numeric(8,2) not null,
  special_instructions text
);

-- Reward transactions table
create table if not exists reward_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  order_id uuid references orders(id),
  type text not null check (type in ('earned', 'redeemed')),
  points integer not null,
  balance_after integer not null,
  description text,
  created_at timestamptz default now()
);

-- Function to update reward points
create or replace function update_reward_points(p_user_id uuid, p_points_change integer)
returns void as $$
begin
  update profiles
  set reward_points = greatest(0, reward_points + p_points_change),
      updated_at = now()
  where id = p_user_id;
end;
$$ language plpgsql security definer;

-- Enable Realtime on orders table
alter publication supabase_realtime add table orders;

-- RLS Policies
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reward_transactions enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Addresses: users can CRUD their own addresses
create policy "Users can manage own addresses" on addresses for all using (auth.uid() = user_id);

-- Menu items: everyone can read
create policy "Anyone can view menu" on menu_items for select to anon, authenticated using (true);

-- Orders: users can read their own, service role can do everything
create policy "Users can view own orders" on orders for select using (auth.uid() = user_id);
create policy "Users can insert orders" on orders for insert with check (auth.uid() = user_id);

-- Order items: users can read items of their orders
create policy "Users can view own order items" on order_items for select
  using (exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));

-- Reward transactions: users can read their own
create policy "Users can view own rewards" on reward_transactions for select using (auth.uid() = user_id);


-- Driver locations table (live tracking for deliveries)
create table if not exists driver_locations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null unique,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  updated_at timestamptz default now()
);

alter publication supabase_realtime add table driver_locations;
alter table driver_locations enable row level security;
create policy "Anyone can view driver locations" on driver_locations for select to authenticated using (true);


-- Store hours table (one row per day of week)
create table if not exists store_hours (
  id serial primary key,
  day_of_week integer not null unique check (day_of_week between 0 and 6), -- 0=Sunday, 6=Saturday
  day_name text not null,
  open_time time not null default '04:30',
  close_time time not null default '12:30',
  delivery_start time,
  delivery_end time,
  is_closed boolean default false,
  updated_at timestamptz default now()
);

-- Anyone can read store hours (needed for checkout)
alter table store_hours enable row level security;
create policy "Anyone can view store hours" on store_hours for select to anon, authenticated using (true);

-- Seed default hours (Mon-Sun, 4:30 AM - 12:30 PM)
insert into store_hours (day_of_week, day_name, open_time, close_time, delivery_start, delivery_end) values
  (0, 'Sunday',    '04:30', '12:30', '07:00', '12:00'),
  (1, 'Monday',    '04:30', '12:30', '07:00', '12:00'),
  (2, 'Tuesday',   '04:30', '12:30', '07:00', '12:00'),
  (3, 'Wednesday', '04:30', '12:30', '07:00', '12:00'),
  (4, 'Thursday',  '04:30', '12:30', '07:00', '12:00'),
  (5, 'Friday',    '04:30', '12:30', '07:00', '12:00'),
  (6, 'Saturday',  '04:30', '12:30', '07:00', '12:00')
on conflict (day_of_week) do nothing;


-- ============================================
-- SEED DATA: Menu Items
-- ============================================

insert into menu_items (category, name, description, price, sort_order) values
-- Breakfast
('breakfast', 'Bacon, Egg & Cheese Kolache', 'Savory kolache stuffed with bacon, scrambled egg, and melted cheese', 3.49, 1),
('breakfast', 'Sausage Kolache', 'Classic kolache with smoked sausage link', 2.99, 2),
('breakfast', 'Breakfast Sandwich', 'Egg, cheese, and your choice of bacon or sausage on a fresh bun', 4.99, 3),
('breakfast', 'Ham & Cheese Croissant', 'Buttery croissant with ham and Swiss cheese', 4.49, 4),
('breakfast', 'Breakfast Taco', 'Flour tortilla with scrambled eggs, cheese, and salsa', 2.99, 5),

-- Donuts
('donuts', 'Glazed Donut', 'Our signature hand-glazed donut, made fresh every morning', 1.49, 1),
('donuts', 'Chocolate Iced Donut', 'Classic donut with rich chocolate icing', 1.79, 2),
('donuts', 'Strawberry Sprinkle Donut', 'Pink strawberry icing topped with rainbow sprinkles', 1.79, 3),
('donuts', 'Maple Bacon Donut', 'Maple glaze topped with crispy bacon bits', 2.49, 4),
('donuts', 'Cinnamon Sugar Donut', 'Warm donut rolled in cinnamon sugar', 1.49, 5),
('donuts', 'Boston Cream Donut', 'Filled with vanilla custard and topped with chocolate', 2.29, 6),
('donuts', 'Apple Fritter', 'Large apple-cinnamon fritter with glaze', 2.99, 7),
('donuts', 'Blueberry Cake Donut', 'Dense, moist blueberry cake donut', 1.99, 8),
('donuts', 'Dozen Glazed', 'A dozen of our famous glazed donuts', 14.99, 9),
('donuts', 'Half Dozen Assorted', 'Pick any 6 donuts from our selection', 9.99, 10),

-- Drinks
('drinks', 'Drip Coffee', 'Fresh brewed coffee, regular or decaf', 1.99, 1),
('drinks', 'Iced Coffee', 'Cold brewed coffee served over ice', 2.99, 2),
('drinks', 'Café Latte', 'Espresso with steamed milk', 3.99, 3),
('drinks', 'Hot Chocolate', 'Rich and creamy hot chocolate', 2.99, 4),
('drinks', 'Orange Juice', 'Fresh-squeezed orange juice', 2.49, 5),
('drinks', 'Milk', 'Whole or chocolate milk', 1.99, 6),
('drinks', 'Bottled Water', 'Purified water', 1.49, 7);
