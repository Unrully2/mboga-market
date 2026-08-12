-- Idempotent: add product_rating used by the reviews API
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS product_rating INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_product_rating_range'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_product_rating_range
      CHECK (product_rating IS NULL OR (product_rating >= 1 AND product_rating <= 5));
  END IF;
END $$;
