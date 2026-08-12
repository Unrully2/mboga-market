# Mboga Market — Production checklist

## Authentication & logout
- [x] Logout all roles + confirmation + server signOut + replace
- [x] Cache-Control no-store on protected routes
- [x] Middleware session gate
- [ ] Manual QA on running build

## API authorization
- [x] requireAuth / requireRole
- [x] Customer / Vendor / Rider / Admin gated routes
- [x] Order [id] explicit role ownership
- [x] Orders list rider scoped to assigned deliveries
- [x] Atomic rider accept (409)
- [x] Atomic rider delivery status via RPC

## Zod validation
- [x] orderCreateSchema (MPESA | CASH_ON_DELIVERY, optional addressId)
- [x] orders POST uses only parsed.data
- [x] registerSchema on /api/auth/register
- [x] Admin categories / products / vendors
- [x] Cart, addresses, favorites, notifications, promo, reviews, delivery, pay

## Rate limiting
- [x] Per-instance in-memory limiter (documented — NOT distributed)
- [x] Login, register, STK, reviews, promo

## M-Pesa
- [x] STK callback fail-closed in production
- [x] B2C result + timeout fail-closed in production
- [x] Prefer x-callback-key
- [x] Payment retry same order
- [x] Reconcile endpoint
- [ ] Live Daraja sandbox E2E

## Database / RLS
- [x] 004 + 005 migrations (rider order scope, delivery RLS by role, atomic delivery RPC)
- [ ] Apply migrations on production Supabase

## Ops (external)
- [ ] Staging / monitoring / backups / CI / production deploy
