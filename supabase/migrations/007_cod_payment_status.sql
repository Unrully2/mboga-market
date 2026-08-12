-- COD payments must not remain PENDING (reconciliation must ignore them)
-- Heal existing rows
UPDATE public.payments
SET status = 'NOT_REQUIRED'
WHERE method IN ('CASH_ON_DELIVERY', 'COD')
  AND status = 'PENDING';

-- Note: create_order in 002 was also patched to insert NOT_REQUIRED for COD.
-- If 002 was already applied on a live DB before that patch, re-apply the
-- function body from 002 (with the COD payment status CASE) via SQL editor
-- or re-run the CREATE OR REPLACE section from 002_security_atomicity.sql.
