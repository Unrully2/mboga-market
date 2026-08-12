-- Atomic rider delivery status update + tighter deliveries RLS

-- Atomic: update delivery + transition order in one function
CREATE OR REPLACE FUNCTION public.rider_update_delivery_status(
  p_delivery_id uuid,
  p_rider_user_id uuid,
  p_delivery_status text,
  p_order_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id uuid;
  v_delivery record;
  v_order_id uuid;
BEGIN
  SELECT id INTO v_rider_id FROM riders WHERE user_id = p_rider_user_id;
  IF v_rider_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_RIDER';
  END IF;

  SELECT * INTO v_delivery FROM deliveries
  WHERE id = p_delivery_id AND rider_id = v_rider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOT_FOUND';
  END IF;

  -- Update delivery row
  UPDATE deliveries SET
    status = p_delivery_status,
    picked_up_at = CASE WHEN p_delivery_status = 'PICKED_UP' THEN COALESCE(picked_up_at, now()) ELSE picked_up_at END,
    delivered_at = CASE WHEN p_delivery_status = 'DELIVERED' THEN now() ELSE delivered_at END
  WHERE id = p_delivery_id;

  v_order_id := v_delivery.order_id;

  -- Transition order via existing state machine
  PERFORM transition_order_status(
    v_order_id,
    p_order_status,
    p_rider_user_id,
    'RIDER',
    'Delivery ' || p_delivery_status
  );

  IF p_delivery_status = 'DELIVERED' THEN
    UPDATE riders SET
      is_available = true,
      total_deliveries = COALESCE(total_deliveries, 0) + 1
    WHERE id = v_rider_id;

    INSERT INTO rider_earnings (rider_id, delivery_id, amount, description)
    VALUES (v_rider_id, p_delivery_id, COALESCE(v_delivery.earnings, 80), 'Delivery completed');

    -- Complete order
    PERFORM transition_order_status(
      v_order_id,
      'COMPLETED',
      p_rider_user_id,
      'RIDER',
      'Order completed after delivery'
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'delivery_status', p_delivery_status, 'order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rider_update_delivery_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_update_delivery_status TO service_role;

-- Fix deliveries RLS: pending list only for RIDER role
DROP POLICY IF EXISTS deliveries_access ON deliveries;
CREATE POLICY deliveries_access ON deliveries
  FOR SELECT USING (
    -- Admin sees all
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    -- Rider: available pending OR own assignment
    OR (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'RIDER')
      AND (
        (status = 'PENDING' AND rider_id IS NULL)
        OR rider_id IN (SELECT id FROM riders WHERE user_id = auth.uid())
      )
    )
    -- Vendor: deliveries for their orders only
    OR (
      order_id IN (
        SELECT o.id FROM orders o
        JOIN vendors v ON v.id = o.vendor_id
        WHERE v.user_id = auth.uid()
      )
    )
    -- Customer: deliveries for their orders only
    OR (
      order_id IN (
        SELECT o.id FROM orders o
        JOIN customers c ON c.id = o.customer_id
        WHERE c.user_id = auth.uid()
      )
    )
  );
