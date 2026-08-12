-- Payment integrity: SYSTEM transitions, B2C identifier columns

-- Allow nullable actor for SYSTEM (M-Pesa callbacks)
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
  v_created_by UUID;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Idempotent: already at target status
  IF v_order.status = p_new_status THEN
    RETURN jsonb_build_object('order_id', p_order_id, 'status', p_new_status, 'noop', true);
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

  v_created_by := CASE WHEN p_actor_role = 'SYSTEM' THEN NULL ELSE p_actor_user_id END;

  INSERT INTO order_status_history (order_id, status, note, created_by)
  VALUES (p_order_id, p_new_status, p_note, v_created_by);

  RETURN jsonb_build_object('order_id', p_order_id, 'status', p_new_status);
END;
$$;

-- B2C tracking columns
ALTER TABLE public.vendor_payouts
  ADD COLUMN IF NOT EXISTS originator_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS conversation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_vpayout_originator ON public.vendor_payouts(originator_conversation_id);
CREATE INDEX IF NOT EXISTS idx_vpayout_conversation ON public.vendor_payouts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout ON public.payments(checkout_request_id);

COMMENT ON COLUMN public.vendor_payouts.originator_conversation_id IS 'OriginatorConversationID sent to Safaricom (usually payout UUID)';
COMMENT ON COLUMN public.vendor_payouts.conversation_id IS 'ConversationID returned by Safaricom on B2C accept';
