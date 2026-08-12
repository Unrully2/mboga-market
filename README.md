# Mboga Market

**Fresh from your neighbourhood.**

Hyperlocal fresh produce marketplace for Kenya (Kiambu pilot).

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- **Supabase** (PostgreSQL + Auth + Storage + Realtime)
- M-Pesa Daraja (STK Push + B2C)
- Lucide icons
- **No Prisma**

## Quick start

1. Create a project at [supabase.com](https://supabase.com)
2. Follow **SUPABASE_SETUP.md** (run SQL migration + create buckets)
3. Copy `.env.example` → `.env` and fill Supabase keys
4. `npm install && npm run dev`
5. Open http://localhost:3000

## Roles

| Role | Path after login |
|------|------------------|
| Customer | `/customer` |
| Vendor | `/vendor` |
| Rider | `/rider` |
| Admin | `/admin` |

Demo users are created via Supabase Auth after you run seed instructions in SUPABASE_SETUP.md.

## M-Pesa

Server-side only. Set `MPESA_*` env vars. Payments only marked COMPLETED after Safaricom callback (`ResultCode === 0`).

---

## Production readiness updates (this build)

### Phase 1 — Fundamentals
- Consistent **logout** with confirmation dialog on Customer, Vendor, Rider, and Admin
- Shared `useAuth` hook (role checks + redirect + reload)
- Middleware requires session for `/customer`, `/vendor`, `/rider`, `/admin`
- Hardened logout API (`Cache-Control: no-store`)
- Shared error banners, loading skeletons, empty states

### Phase 2 — Navigation
- Shared **BottomNav** (Lucide) for Customer / Vendor / Rider
- Shared **AccountMenu** (profile, links, logout)
- **AdminShell** with desktop sidebar + mobile drawer + logout
- **AppHeader** component for role dashboards

### Phase 3 — Visual
- Replaced emoji navigation / key CTAs with **Lucide** icons
- Design tokens already in Tailwind (`primary` green, `accent` orange)
- Shared UI primitives: `ConfirmDialog`, `EmptyState`, `LoadingSkeleton`, `ErrorBanner`

### Phase 4 — Marketplace UX foundations
- Consistent account entry points across roles
- Better empty / loading / error states on primary dashboards
- Order / delivery entry points use shared nav

### Phase 5 — Production
- PWA **manifest** + layout metadata (`theme-color`, apple web app)
- Safe-area CSS for notched phones
- Service-role client remains server-only (documented)
- Middleware matcher excludes `/api/` so callbacks stay reachable

### Still recommended before real launch
- Full RLS audit on every table
- Rate limiting on auth + payment endpoints
- M-Pesa production credentials + callback URL validation
- Staging environment separate from production DB
- Real PWA icons (`public/icon-192.png`, `icon-512.png`)
- Error monitoring (e.g. Sentry)
- Automated tests for order + payment state machine
- Push notifications via Supabase Realtime / FCM

## Project structure (key)

```
src/
  app/           # App Router pages + API routes
  components/
    layout/      # AppHeader, BottomNav, AccountMenu, AdminShell
    ui/          # ConfirmDialog, EmptyState, LoadingSkeleton, ErrorBanner
  hooks/         # useAuth
  lib/           # auth, mpesa, supabase clients, services
middleware.ts    # Session protection for role areas
```

## License

Private / proprietary for the Mboga Market pilot.

---

## Pre-launch

See **PRODUCTION_CHECKLIST.md** for the full QA and security list.

### Quick logout QA
```
Login → browse → Logout (confirm) → browser Back → refresh
→ try /customer /vendor /rider /admin
```
Expected: login screen only; no authenticated content.
