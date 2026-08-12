-- RLS hardening for Mboga Market (run after 001–003)

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Addresses: customer owns
DROP POLICY IF EXISTS addresses_owner ON addresses;
CREATE POLICY addresses_owner ON addresses
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Cart: customer owns
DROP POLICY IF EXISTS cart_items_owner ON cart_items;
CREATE POLICY cart_items_owner ON cart_items
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Orders: customer own / vendor own / rider ONLY via assigned delivery / admin
DROP POLICY IF EXISTS orders_access ON orders;
CREATE POLICY orders_access ON orders
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
    OR id IN (
      SELECT d.order_id FROM deliveries d
      JOIN riders r ON r.id = d.rider_id
      WHERE r.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Payments: customer of order or admin
DROP POLICY IF EXISTS payments_access ON payments;
CREATE POLICY payments_access ON payments
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE c.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Deliveries: available pending (null rider) OR assigned to self OR admin
DROP POLICY IF EXISTS deliveries_access ON deliveries;
CREATE POLICY deliveries_access ON deliveries
  FOR SELECT USING (
    (status = 'PENDING' AND rider_id IS NULL)
    OR rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Notifications: own only
DROP POLICY IF EXISTS notifications_owner ON notifications;
CREATE POLICY notifications_owner ON notifications
  FOR ALL USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Favorites: customer owns
DROP POLICY IF EXISTS favorites_owner ON favorites;
CREATE POLICY favorites_owner ON favorites
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Reviews: public read; insert own
DROP POLICY IF EXISTS reviews_select ON reviews;
CREATE POLICY reviews_select ON reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS reviews_insert_own ON reviews;
CREATE POLICY reviews_insert_own ON reviews
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Vendor products: vendor owns their rows for write; public approved read via API
DROP POLICY IF EXISTS vendor_products_vendor ON vendor_products;
CREATE POLICY vendor_products_vendor ON vendor_products
  FOR ALL USING (
    vendor_id IN (SELECT id FROM vendors WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Rating constraints (+ ensure product_rating column exists)
ALTER TABLE IF EXISTS reviews ADD COLUMN IF NOT EXISTS product_rating INT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_vendor_rating_range') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_vendor_rating_range
      CHECK (vendor_rating >= 1 AND vendor_rating <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_rating_range') THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_product_rating_range
      CHECK (product_rating IS NULL OR (product_rating >= 1 AND product_rating <= 5));
  END IF;
END $$;

-- Unique checkout_request_id
CREATE UNIQUE INDEX IF NOT EXISTS payments_checkout_request_id_unique
  ON payments (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;
