# Kindred Accounting

Internal accounting app for Kindred Church: uncategorized-transaction
categorizing, reimbursement checks, monthly board reports with private share
links, and a read-only Ask interface over QuickBooks data.

Stack: Next.js 15 (App Router) · Supabase (Postgres, Auth, RLS) · Vercel.

## Phase 1 (this code)

Google sign-in gated by an allowlist, roles (admin / exec / board), the Users
management screen, an append-only audit log, and the app shell. Reports land
in Phase 2, QuickBooks (Uncats, Reimbursements, board numbers) in Phase 3,
Ask in Phase 4.

## Deploy

1. **Push this repo**

   ```bash
   git init -b main
   git add -A
   git commit -m "Phase 1: auth, allowlist, users, app shell"
   git remote add origin git@github.com:YOURUSER/kindred-accounting.git
   git push -u origin main
   ```

2. **Database**: open the Supabase SQL Editor and run
   `supabase/migrations/0001_init.sql` (the whole file, once). It creates the
   allowlist and audit tables, RLS, helper functions, and seeds
   nate@ and tyler@wearekindred.church.

3. **Signup gate hook**: Supabase dashboard → Authentication → Hooks →
   "Before User Created" → Postgres function → schema `public`, function
   `before_user_created_hook` → enable. This rejects sign-ups from anyone not
   on the allowlist at the door. (The app also checks after sign-in, and RLS
   denies everything regardless, but turn the hook on.)

4. **Auth URLs**: Supabase dashboard → Authentication → URL Configuration:
   - Site URL: `https://accounting.wearekindred.church`
   - Additional redirect URLs:
     `https://accounting.wearekindred.church/auth/callback`,
     `http://localhost:3000/auth/callback`, and your Vercel preview domain
     pattern `https://*-YOURTEAM.vercel.app/auth/callback` if you use previews.

5. **Vercel**: Add New → Project → import the repo. Framework auto-detects.
   Add the environment variables from `.env.example` (all three Supabase
   values plus `NEXT_PUBLIC_APP_URL`). Deploy.

6. **Domain**: Vercel project → Settings → Domains → add
   `accounting.wearekindred.church`, then create the CNAME it shows at your
   DNS host.

7. **Smoke test**: open the app → sign in as nate@ (lands on Home) → Users
   tab shows you and Tyler → add a test gmail as Board → sign in with it in a
   private window (should land on Reports, and see only Reports) → deactivate
   it → confirm that account is refused. Try a random Google account:
   refused at sign-in.

## Local dev

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

## Security model (don't regress these)

- Every page and server action verifies the caller's role server-side via
  `my_role()` (SECURITY DEFINER; allowlist is admin-read-only under RLS).
- The service key client (`lib/supabase/admin.ts`) is only used in server
  actions after an explicit role check, and never in anything client-reachable
  without one.
- `audit_log` is append-only: no update/delete policies, ever.
- All tables ship with RLS enabled and deny-by-default; new tables in later
  phases must do the same.
- No secrets in the browser: only `NEXT_PUBLIC_SUPABASE_URL` and the
  publishable key are public.
