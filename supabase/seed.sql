-- Run AFTER 001_initial_schema.sql
-- Categories & catalog products (no auth users — register via app or Auth dashboard)

INSERT INTO public.categories (id, name, slug, icon, sort_order) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Vegetables', 'vegetables', '🥬', 1),
  ('a0000000-0000-4000-8000-000000000002', 'Fruits', 'fruits', '🍌', 2),
  ('a0000000-0000-4000-8000-000000000003', 'Roots & Tubers', 'roots', '🥔', 3),
  ('a0000000-0000-4000-8000-000000000004', 'Herbs & Spices', 'herbs', '🌿', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.products (category_id, name, slug, unit, base_price, image) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Sukuma Wiki', 'sukuma-wiki', '1 bunch', 20, '🥬'),
  ('a0000000-0000-4000-8000-000000000001', 'Spinach', 'spinach', '1 bunch', 30, '🥬'),
  ('a0000000-0000-4000-8000-000000000001', 'Cabbage', 'cabbage', '1 piece', 50, '🥬'),
  ('a0000000-0000-4000-8000-000000000001', 'Tomatoes', 'tomatoes', '1 kg', 80, '🍅'),
  ('a0000000-0000-4000-8000-000000000001', 'Onions', 'onions', '1 kg', 70, '🧅'),
  ('a0000000-0000-4000-8000-000000000001', 'Green Pepper', 'green-pepper', '1 kg', 100, '🫑'),
  ('a0000000-0000-4000-8000-000000000002', 'Bananas', 'bananas', '1 bunch', 50, '🍌'),
  ('a0000000-0000-4000-8000-000000000002', 'Avocado', 'avocado', '1 piece', 25, '🥑'),
  ('a0000000-0000-4000-8000-000000000002', 'Mangoes', 'mangoes', '1 piece', 30, '🥭'),
  ('a0000000-0000-4000-8000-000000000002', 'Oranges', 'oranges', '1 kg', 60, '🍊'),
  ('a0000000-0000-4000-8000-000000000003', 'Potatoes', 'potatoes', '1 kg', 80, '🥔'),
  ('a0000000-0000-4000-8000-000000000003', 'Sweet Potatoes', 'sweet-potatoes', '1 kg', 70, '🍠'),
  ('a0000000-0000-4000-8000-000000000003', 'Carrots', 'carrots', '1 kg', 60, '🥕'),
  ('a0000000-0000-4000-8000-000000000004', 'Coriander', 'coriander', '1 bunch', 10, '🌿'),
  ('a0000000-0000-4000-8000-000000000004', 'Garlic', 'garlic', '1 piece', 10, '🧄'),
  ('a0000000-0000-4000-8000-000000000004', 'Ginger', 'ginger', '100 g', 20, '🫚')
ON CONFLICT DO NOTHING;

INSERT INTO public.promo_codes (code, description, discount_type, discount_value, min_order, max_uses, is_active)
VALUES ('MBOGA50', 'KES 50 off orders over 300', 'FIXED', 50, 300, 1000, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('service_fee', '10'),
  ('default_delivery_fee', '50'),
  ('pilot_area', 'Kiambu')
ON CONFLICT (key) DO NOTHING;
