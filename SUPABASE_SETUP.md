# Mboga Market — Supabase Setup (simple guide)

## 1. Create a Supabase project

1. Go to https://supabase.com and sign in  
2. Click **New project**  
3. Name it `mboga-market`, choose a region, set a database password  
4. Wait until the project is ready  

## 2. Get your keys

1. Open **Project Settings** (gear icon) → **API**  
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

## 3. Run the database migration

1. In Supabase, open **SQL Editor**  
2. Click **New query**  
3. Open the file `supabase/migrations/001_initial_schema.sql` from this project  
4. Paste **all** of it into the SQL Editor  
5. Click **Run**  
6. If you see errors about `supabase_realtime` publication, you can ignore those lines or enable Realtime under **Database → Replication**

## 4. Seed catalog data

1. Still in **SQL Editor**  
2. Paste contents of `supabase/seed.sql`  
3. Click **Run**

## 5. Storage buckets

1. Open **Storage**  
2. Create public buckets:
   - `product-images`
   - `vendor-images`
   - `profile-images`
   - `vendor-documents` (can be private)

## 6. Auth settings

1. **Authentication → Providers**  
2. Ensure **Email** is enabled  
3. (Optional) Disable “Confirm email” for easier testing:
   - Authentication → Providers → Email → turn off “Confirm email”

The app uses synthetic emails like `2547…@users.mboga.local` so phone login works without SMS OTP.

## 7. Environment variables

Create a `.env` file (local) or set Vercel env vars:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 8. Run the app

```bash
npm install
npm run dev
```

## 9. Create test accounts

**Public registration cannot create ADMIN accounts.**  
`/api/auth/register` only allows `CUSTOMER`, `VENDOR`, or `RIDER`. Submitting `role=ADMIN` is rejected with 403.

Use **Register** in the app for:

- Customer: any phone e.g. `0712345678` + password  
- Vendor: choose Vendor role, add business name  
- Rider: choose Rider role  

### Promote an existing user to ADMIN (SQL only)

1. Register a normal account first (e.g. customer).  
2. In **SQL Editor** run (replace the phone):

```sql
UPDATE public.profiles
SET role = 'ADMIN'
WHERE phone = '254712345678';

INSERT INTO public.admins (user_id, name)
SELECT id, COALESCE(name, 'Admin') FROM public.profiles
WHERE phone = '254712345678'
ON CONFLICT (user_id) DO NOTHING;
```

3. Log out and log in again so the session picks up the new role.

Approve vendors in Admin → Vendors.

## 10. Deploy on Vercel

1. Push repo to GitHub  
2. Import on Vercel  
3. Add the same env vars  
4. Deploy  
5. Set `NEXT_PUBLIC_APP_URL` and M-Pesa callback URLs to your Vercel domain  

## M-Pesa (optional for live payments)

Add Safaricom Daraja credentials in env.  
Callbacks:

- `/api/payments/mpesa/callback`
- `/api/payments/mpesa/b2c/result`
- `/api/payments/mpesa/b2c/timeout`

## 11. Security migration (required)

After `001_initial_schema.sql` and `seed.sql`, also run:

**SQL Editor → paste entire file:**
`supabase/migrations/002_security_atomicity.sql`

This adds:
- `create_order()` — atomic order + cart clear + promo + stock
- `transition_order_status()` — validated status changes
- Stronger RLS on payments, documents, payouts, earnings
- Idempotency columns on payments and vendor_payouts

## 12. Optional M-Pesa callback secret

In env:

```
MPESA_CALLBACK_SECRET=long-random-string
```

Then set Safaricom callback URL to:

```
https://your-domain.com/api/payments/mpesa/callback?key=long-random-string
```

Same for B2C result/timeout URLs.


## 13. Payment integrity migration

After `002_security_atomicity.sql`, run:

**`supabase/migrations/003_payment_integrity.sql`**

This updates:
- `transition_order_status` for SYSTEM (M-Pesa) with idempotent no-op if already at status
- B2C columns: `originator_conversation_id`, `conversation_id`
