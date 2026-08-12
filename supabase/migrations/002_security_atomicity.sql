-- MBOGA MARKET — Security & atomicity (run after 001)
-- Atomic order creation, promo usage, stock checks, stronger RLS, status transitions

-- ============================================
-- 1. Stock quantity: use stock_qty when present
-- ============================================
-- vendor_products.stock_qty already exists; OUT_OF_STOCK when qty hits 0

-- ============================================
-- 2. Allowed order status transitions
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_status_transitions (
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  allowed_roles TEXT[] NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

TRUNCATE public.order_status_transitions;
INSERT INTO public.order_status_transitions (from_status, to_status, allowed_roles) VALUES
  ('PENDING_PAYMENT', 'PAYMENT_CONFIRMED', ARRAY['SYSTEM','ADMIN']),
  ('PENDING_PAYMENT', 'CANCELLED', ARRAY['CUSTOMER','ADMIN']),
  ('PAYMENT_CONFIRMED', 'ORDER_RECEIVED', ARRAY['SYSTEM','ADMIN']),
  ('ORDER_RECEIVED', 'VENDOR_ACCEPTED', ARRAY['VENDOR','ADMIN']),
  ('ORDER_RECEIVED', 'REJECTED', ARRAY['VENDOR','ADMIN']),
  ('ORDER_RECEIVED', 'CANCELLED', ARRAY['ADMIN']),
  ('VENDOR_ACCEPTED', 'PREPARING', ARRAY['VENDOR','ADMIN']),
  ('VENDOR_ACCEPTED', 'REJECTED', ARRAY['VENDOR','ADMIN']),
  ('PREPARING', 'READY_FOR_PICKUP', ARRAY['VENDOR','ADMIN']),
  ('READY_FOR_PICKUP', 'RIDER_ASSIGNED', ARRAY['RIDER','ADMIN','SYSTEM']),
  ('RIDER_ASSIGNED', 'PICKED_UP', ARRAY['RIDER','ADMIN']),
  ('PICKED_UP', 'OUT_FOR_DELIVERY', ARRAY['RIDER','ADMIN']),
  ('OUT_FOR_DELIVERY', 'DELIVERED', ARRAY['RIDER','ADMIN']),
  ('DELIVERED', 'COMPLETED', ARRAY['SYSTEM','ADMIN','RIDER']),
  ('PENDING_PAYMENT', 'ORDER_RECEIVED', ARRAY['SYSTEM','ADMIN']); -- COD path

-- ============================================
-- 3. Atomic create_order RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_customer_user_id UUID,
  p_vendor_id UUID,
  p_address_id UUID,
  p_payment_method TEXT,
  p_delivery_notes TEXT DEFAULT NULL,
  p_preferred_time TEXT DEFAULT NULL,
  p_promo_code TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_service_fee NUMERIC DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_customer_phone TEXT;
  v_vendor RECORD;
  v_address_id UUID;
  v_promo RECORD;
  v_item RECORD;
  v_subtotal NUMERIC := 0;
  v_delivery_fee NUMERIC;
  v_discount NUMERIC := 0;
  v_total NUMERIC;
  v_order_id UUID;
  v_order_number TEXT;
  v_status TEXT;
  v_applied_promo TEXT := NULL;
  v_line NUMERIC;
  v_items JSONB := '[]'::JSONB;
BEGIN
  -- Authenticated customer profile
  SELECT c.id, c.phone INTO v_customer_id, v_customer_phone
  FROM customers c
  JOIN profiles p ON p.id = c.user_id
  WHERE c.user_id = p_customer_user_id
    AND p.role = 'CUSTOMER'
    AND p.is_active = true;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED_CUSTOMER';
  END IF;

  -- Vendor must be approved and open
  SELECT * INTO v_vendor FROM vendors
  WHERE id = p_vendor_id AND status = 'APPROVED' AND is_open = true
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENDOR_UNAVAILABLE';
  END IF;

  -- Address ownership (optional but if provided must belong to customer)
  IF p_address_id IS NOT NULL THEN
    SELECT id INTO v_address_id FROM addresses
    WHERE id = p_address_id AND customer_id = v_customer_id;
    IF v_address_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_ADDRESS';
    END IF;
  ELSE
    SELECT id INTO v_address_id FROM addresses
    WHERE customer_id = v_customer_id AND is_default = true
    LIMIT 1;
  END IF;

  -- Build lines from cart; lock vendor_products rows
  FOR v_item IN
    SELECT ci.id AS cart_id, ci.quantity, ci.instructions,
           vp.id AS vp_id, vp.price, vp.stock_status, vp.is_available, vp.stock_qty,
           vp.vendor_id, COALESCE(vp.custom_name, pr.name) AS product_name, pr.unit
    FROM cart_items ci
    JOIN vendor_products vp ON vp.id = ci.vendor_product_id
    JOIN products pr ON pr.id = vp.product_id
    WHERE ci.customer_id = v_customer_id
      AND vp.vendor_id = p_vendor_id
    FOR UPDATE OF vp
  LOOP
    IF NOT v_item.is_available OR v_item.stock_status = 'OUT_OF_STOCK' THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', v_item.product_name;
    END IF;
    -- Atomic stock: if stock_qty tracked, ensure enough and decrement
    IF v_item.stock_qty IS NOT NULL THEN
      IF v_item.stock_qty < v_item.quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_item.product_name;
      END IF;
      UPDATE vendor_products
      SET stock_qty = stock_qty - v_item.quantity,
          stock_status = CASE WHEN stock_qty - v_item.quantity <= 0 THEN 'OUT_OF_STOCK'
                              WHEN stock_qty - v_item.quantity <= 5 THEN 'LOW_STOCK'
                              ELSE stock_status END,
          is_available = CASE WHEN stock_qty - v_item.quantity <= 0 THEN false ELSE is_available END
      WHERE id = v_item.vp_id;
    END IF;

    v_line := v_item.price * v_item.quantity;
    v_subtotal := v_subtotal + v_line;
    v_items := v_items || jsonb_build_object(
      'vendor_product_id', v_item.vp_id,
      'product_name', v_item.product_name,
      'unit', v_item.unit,
      'price', v_item.price,
      'quantity', v_item.quantity,
      'instructions', v_item.instructions,
      'subtotal', v_line
    );
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  IF v_subtotal < COALESCE(v_vendor.min_order_amount, 0) THEN
    RAISE EXCEPTION 'BELOW_MIN_ORDER:%', v_vendor.min_order_amount;
  END IF;

  v_delivery_fee := COALESCE(v_vendor.delivery_fee, 50);

  -- Atomic promo (lock row)
  IF p_promo_code IS NOT NULL AND length(trim(p_promo_code)) > 0 THEN
    SELECT * INTO v_promo FROM promo_codes
    WHERE code = upper(trim(p_promo_code))
    FOR UPDATE;

    IF NOT FOUND OR NOT v_promo.is_active THEN
      RAISE EXCEPTION 'INVALID_PROMO';
    END IF;
    IF v_promo.starts_at IS NOT NULL AND v_promo.starts_at > now() THEN
      RAISE EXCEPTION 'INVALID_PROMO';
    END IF;
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
      RAISE EXCEPTION 'INVALID_PROMO';
    END IF;
    IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN
      RAISE EXCEPTION 'PROMO_EXHAUSTED';
    END IF;
    IF v_subtotal < COALESCE(v_promo.min_order, 0) THEN
      RAISE EXCEPTION 'PROMO_MIN_ORDER';
    END IF;

    IF v_promo.discount_type = 'FIXED' THEN
      v_discount := v_promo.discount_value;
    ELSIF v_promo.discount_type = 'PERCENTAGE' THEN
      v_discount := round(v_subtotal * v_promo.discount_value / 100);
    ELSIF v_promo.discount_type = 'FREE_DELIVERY' THEN
      v_discount := v_delivery_fee;
    END IF;

    UPDATE promo_codes SET used_count = used_count + 1 WHERE id = v_promo.id;
    v_applied_promo := v_promo.code;
  END IF;

  v_total := greatest(0, v_subtotal + v_delivery_fee + COALESCE(p_service_fee, 10) - v_discount);
  v_order_number := 'MBG-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_status := CASE WHEN p_payment_method = 'CASH_ON_DELIVERY' THEN 'ORDER_RECEIVED' ELSE 'PENDING_PAYMENT' END;

  INSERT INTO orders (
    order_number, customer_id, vendor_id, address_id, status, payment_method,
    subtotal, delivery_fee, service_fee, discount, total,
    delivery_notes, preferred_time, promo_code
  ) VALUES (
    v_order_number, v_customer_id, p_vendor_id, v_address_id, v_status, p_payment_method,
    v_subtotal, v_delivery_fee, COALESCE(p_service_fee, 10), v_discount, v_total,
    p_delivery_notes, p_preferred_time, v_applied_promo
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, vendor_product_id, product_name, unit, price, quantity, instructions, subtotal)
  SELECT v_order_id,
    (e->>'vendor_product_id')::UUID,
    e->>'product_name',
    e->>'unit',
    (e->>'price')::NUMERIC,
    (e->>'quantity')::NUMERIC,
    e->>'instructions',
    (e->>'subtotal')::NUMERIC
  FROM jsonb_array_elements(v_items) e;

  INSERT INTO payments (order_id, method, amount, status, phone)
  VALUES (
    v_order_id,
    p_payment_method,
    v_total,
    CASE WHEN p_payment_method = 'CASH_ON_DELIVERY' THEN 'NOT_REQUIRED' ELSE 'PENDING' END,
    COALESCE(p_phone, v_customer_phone)
  );

  INSERT INTO order_status_history (order_id, status, note, created_by)
  VALUES (
    v_order_id, v_status,
    CASE WHEN p_payment_method = 'CASH_ON_DELIVERY' THEN 'Cash on delivery' ELSE 'Awaiting M-Pesa' END,
    p_customer_user_id
  );

  -- Clear cart for this vendor
  DELETE FROM cart_items
  WHERE customer_id = v_customer_id
    AND vendor_product_id IN (
      SELECT id FROM vendor_products WHERE vendor_id = p_vendor_id
    );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', v_status,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'service_fee', COALESCE(p_service_fee, 10),
    'discount', v_discount,
    'total', v_total,
    'promo_code', v_applied_promo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order TO service_role;

-- ============================================
-- 4. Atomic status transition helper
-- ============================================
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_actor_user_id UUID,
  p_actor_role TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_allowed BOOLEAN;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM order_status_transitions t
    WHERE t.from_status = v_order.status
      AND t.to_status = p_new_status
      AND (p_actor_role = ANY (t.allowed_roles) OR p_actor_role = 'ADMIN')
  ) INTO v_allowed;

  IF NOT v_allowed AND p_actor_role <> 'ADMIN' THEN
    RAISE EXCEPTION 'INVALID_TRANSITION:%->%', v_order.status, p_new_status;
  END IF;

  -- Ownership checks
  IF p_actor_role = 'VENDOR' THEN
    IF NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = v_order.vendor_id AND v.user_id = p_actor_user_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  ELSIF p_actor_role = 'CUSTOMER' THEN
    IF NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = v_order.customer_id AND c.user_id = p_actor_user_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  ELSIF p_actor_role = 'RIDER' THEN
    IF NOT EXISTS (
      SELECT 1 FROM deliveries d JOIN riders r ON r.id = d.rider_id
      WHERE d.order_id = p_order_id AND r.user_id = p_actor_user_id
    ) AND p_new_status <> 'RIDER_ASSIGNED' THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;

  UPDATE orders SET status = p_new_status WHERE id = p_order_id;
  INSERT INTO order_status_history (order_id, status, note, created_by)
  VALUES (p_order_id, p_new_status, p_note, p_actor_user_id);

  RETURN jsonb_build_object('order_id', p_order_id, 'status', p_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_order_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_order_status TO service_role;

-- ============================================
-- 5. Strengthen RLS (drop overly open policies)
-- ============================================

-- Vendor products: public read only available on approved vendors
DROP POLICY IF EXISTS vp_read ON public.vendor_products;
CREATE POLICY vp_read ON public.vendor_products FOR SELECT USING (
  is_available = true
  OR EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  OR public.is_admin()
);

-- Payments: no client insert/update (service role only for writes)
DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.id = payments.order_id AND c.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM orders o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.id = payments.order_id AND v.user_id = auth.uid()
  )
  OR public.is_admin()
);
-- No INSERT/UPDATE/DELETE policies for authenticated → only service_role bypasses RLS

-- Order items insert only via service role (no policy for authenticated insert)
DROP POLICY IF EXISTS order_items_read ON public.order_items;
CREATE POLICY order_items_select ON public.order_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN vendors v ON v.id = o.vendor_id
    WHERE o.id = order_items.order_id
      AND (c.user_id = auth.uid() OR v.user_id = auth.uid() OR public.is_admin())
  )
);

-- Vendor documents: vendor own + admin
DROP POLICY IF EXISTS vendor_documents_all ON public.vendor_documents;
CREATE POLICY vendor_documents_select ON public.vendor_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  OR public.is_admin()
);
CREATE POLICY vendor_documents_write ON public.vendor_documents FOR ALL USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  OR public.is_admin()
);

-- Admins table: admin only
DROP POLICY IF EXISTS admins_all ON public.admins;
CREATE POLICY admins_admin_only ON public.admins FOR ALL USING (public.is_admin());

-- Rider earnings: own rider + admin
DROP POLICY IF EXISTS rider_earnings_all ON public.rider_earnings;
CREATE POLICY rider_earnings_select ON public.rider_earnings FOR SELECT USING (
  EXISTS (SELECT 1 FROM riders r WHERE r.id = rider_id AND r.user_id = auth.uid())
  OR public.is_admin()
);

-- Vendor payouts: vendor read own, admin all
DROP POLICY IF EXISTS vendor_payouts_all ON public.vendor_payouts;
CREATE POLICY vendor_payouts_select ON public.vendor_payouts FOR SELECT USING (
  EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid())
  OR public.is_admin()
);
-- Writes only via service role / admin (no insert policy for non-admin authenticated)

-- Delivery tracking: limited
DROP POLICY IF EXISTS delivery_tracking_all ON public.delivery_tracking;
CREATE POLICY delivery_tracking_select ON public.delivery_tracking FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM deliveries d
    LEFT JOIN riders r ON r.id = d.rider_id
    LEFT JOIN orders o ON o.id = d.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE d.id = delivery_tracking.delivery_id
      AND (r.user_id = auth.uid() OR c.user_id = auth.uid() OR public.is_admin())
  )
);

-- Extra indexes
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_vp_vendor_product ON public.vendor_products(vendor_id, product_id);
CREATE INDEX IF NOT EXISTS idx_cart_customer_vp ON public.cart_items(customer_id, vendor_product_id);

-- Callback idempotency helper column
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS callback_processed_at TIMESTAMPTZ;
ALTER TABLE public.vendor_payouts ADD COLUMN IF NOT EXISTS callback_processed_at TIMESTAMPTZ;

COMMENT ON FUNCTION public.create_order IS 'Atomic order creation: validates auth, address, vendor, stock, promo; creates order+items+payment+history; clears cart';
