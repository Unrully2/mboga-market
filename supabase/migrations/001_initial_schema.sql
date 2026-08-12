-- MBOGA MARKET - Supabase PostgreSQL Schema
-- Run in Supabase Dashboard → SQL Editor
-- NO Prisma

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Profiles linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER','VENDOR','RIDER','ADMIN')),
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  profile_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  national_id TEXT,
  mpesa_number TEXT,
  location TEXT NOT NULL,
  estate TEXT,
  market TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  profile_image TEXT,
  stall_image TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','SUSPENDED','REJECTED')),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_reviews INT NOT NULL DEFAULT 0,
  min_order_amount DOUBLE PRECISION NOT NULL DEFAULT 100,
  delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 50,
  opening_hours TEXT,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON public.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_lat_lng ON public.vendors(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vendors_open ON public.vendors(is_open);

CREATE TABLE IF NOT EXISTS public.vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  national_id TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'boda',
  vehicle_reg TEXT,
  profile_image TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_deliveries INT NOT NULL DEFAULT 0,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_riders_available ON public.riders(is_available);

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  estate TEXT NOT NULL,
  street TEXT,
  landmark TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON public.addresses(customer_id);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  image TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  image TEXT,
  base_price DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);

CREATE TABLE IF NOT EXISTS public.vendor_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  price DOUBLE PRECISION NOT NULL,
  stock_status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK (stock_status IN ('IN_STOCK','OUT_OF_STOCK','LOW_STOCK')),
  stock_qty INT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  custom_name TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_vp_vendor ON public.vendor_products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vp_stock ON public.vendor_products(stock_status);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vendor_product_id UUID NOT NULL REFERENCES public.vendor_products(id) ON DELETE CASCADE,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, vendor_product_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  address_id UUID REFERENCES public.addresses(id),
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('MPESA','CASH_ON_DELIVERY')),
  subtotal DOUBLE PRECISION NOT NULL,
  delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  service_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount DOUBLE PRECISION NOT NULL DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  delivery_notes TEXT,
  preferred_time TEXT,
  promo_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_product_id UUID REFERENCES public.vendor_products(id),
  product_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  instructions TEXT,
  subtotal DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_osh_order ON public.order_status_history(order_id);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  phone TEXT,
  mpesa_receipt TEXT,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  raw_callback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_checkout ON public.payments(checkout_request_id);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.riders(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  earnings DOUBLE PRECISION DEFAULT 0,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider ON public.deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dt_delivery ON public.delivery_tracking(delivery_id);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES public.orders(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  vendor_rating INT NOT NULL CHECK (vendor_rating BETWEEN 1 AND 5),
  delivery_rating INT,
  quality_rating INT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_vendor ON public.reviews(vendor_id);

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  vendor_id UUID,
  product_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_favorites_customer ON public.favorites(customer_id);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL,
  discount_value DOUBLE PRECISION NOT NULL,
  min_order DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  amount DOUBLE PRECISION NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  mpesa_ref TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rider_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.riders(id),
  delivery_id UUID,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','customers','vendors','riders','categories','products','vendor_products','cart_items','orders','payments','deliveries']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- Auto-create profile on auth signup (optional helper)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile is created by app registration API with role metadata
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Order number helper
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'MBG-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN' AND p.is_active = true
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- Customers
CREATE POLICY customers_select ON public.customers FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
  OR EXISTS (SELECT 1 FROM public.vendors v JOIN public.orders o ON o.vendor_id = v.id WHERE v.user_id = auth.uid() AND o.customer_id = customers.id)
);
CREATE POLICY customers_update_own ON public.customers FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY customers_insert_own ON public.customers FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Addresses
CREATE POLICY addresses_all_own ON public.addresses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = addresses.customer_id AND c.user_id = auth.uid())
  OR public.is_admin()
);

-- Categories & products public read
CREATE POLICY categories_read ON public.categories FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY categories_admin ON public.categories FOR ALL USING (public.is_admin());
CREATE POLICY products_read ON public.products FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY products_admin ON public.products FOR ALL USING (public.is_admin());

-- Vendors: public can read approved
CREATE POLICY vendors_read ON public.vendors FOR SELECT USING (status = 'APPROVED' OR user_id = auth.uid() OR public.is_admin());
CREATE POLICY vendors_update_own ON public.vendors FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY vendors_insert ON public.vendors FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Vendor products
CREATE POLICY vp_read ON public.vendor_products FOR SELECT USING (true);
CREATE POLICY vp_vendor_write ON public.vendor_products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_products.vendor_id AND v.user_id = auth.uid())
  OR public.is_admin()
);

-- Cart
CREATE POLICY cart_own ON public.cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = cart_items.customer_id AND c.user_id = auth.uid())
  OR public.is_admin()
);

-- Orders
CREATE POLICY orders_customer ON public.orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = orders.customer_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.deliveries d JOIN public.riders r ON r.id = d.rider_id WHERE d.order_id = orders.id AND r.user_id = auth.uid())
  OR public.is_admin()
);
CREATE POLICY orders_insert_customer ON public.orders FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
  OR public.is_admin()
);
CREATE POLICY orders_update ON public.orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = orders.vendor_id AND v.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = orders.customer_id AND c.user_id = auth.uid())
  OR public.is_admin()
);

-- Order items
CREATE POLICY order_items_read ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    LEFT JOIN public.customers c ON c.id = o.customer_id
    LEFT JOIN public.vendors v ON v.id = o.vendor_id
    WHERE o.id = order_items.order_id AND (c.user_id = auth.uid() OR v.user_id = auth.uid() OR public.is_admin())
  )
);

-- Payments
CREATE POLICY payments_read ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = payments.order_id AND (c.user_id = auth.uid() OR public.is_admin())
  )
);

-- Notifications
CREATE POLICY notifications_own ON public.notifications FOR ALL USING (user_id = auth.uid() OR public.is_admin());

-- Favorites
CREATE POLICY favorites_own ON public.favorites FOR ALL USING (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = favorites.customer_id AND c.user_id = auth.uid())
  OR public.is_admin()
);

-- Reviews
CREATE POLICY reviews_read ON public.reviews FOR SELECT USING (true);
CREATE POLICY reviews_insert ON public.reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.user_id = auth.uid())
);

-- Promo codes readable by authenticated
CREATE POLICY promos_read ON public.promo_codes FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY promos_admin ON public.promo_codes FOR ALL USING (public.is_admin());

-- Riders
CREATE POLICY riders_read ON public.riders FOR SELECT USING (user_id = auth.uid() OR public.is_admin() OR is_available = true);
CREATE POLICY riders_update_own ON public.riders FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- Deliveries
CREATE POLICY deliveries_access ON public.deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.riders r WHERE r.id = deliveries.rider_id AND r.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.orders o JOIN public.customers c ON c.id = o.customer_id WHERE o.id = deliveries.order_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.orders o JOIN public.vendors v ON v.id = o.vendor_id WHERE o.id = deliveries.order_id AND v.user_id = auth.uid())
  OR public.is_admin()
  OR (status = 'PENDING' AND rider_id IS NULL)
);

-- Settings admin only
CREATE POLICY settings_admin ON public.settings FOR ALL USING (public.is_admin());

-- Storage buckets (run separately if needed via dashboard)
-- product-images, vendor-images, profile-images, vendor-documents

-- Enable realtime for key tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_tracking'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;
  END IF;
END $$;
