# Setup and development

## Local app

Use Node.js 24 LTS (the verified local version) and npm. Run from the repository root:

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. Runtime and development dependencies are pinned in package.json and package-lock.json.

## Environment

Local Next.js configuration belongs in `.env.local` at the repository root. This file is ignored by Git. Copy `.env.example` when setting up another checkout and replace the placeholders with that Supabase project's values.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key used by the application client.
- `NEXT_PUBLIC_SITE_URL`: canonical application origin, initially `http://localhost:3000`; used for password recovery email callbacks. Set the actual HTTPS origin before deploying.

These values are intended for public application clients. Database RLS and storage policies must enforce access. Never put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable.

For deployment, configure the same variables in Vercel's environment settings. Restart the development server after changing local environment values; rebuild after changing deployment values.

The local Supabase URL and publishable key have been configured. `.env.local` is ignored by Git; `.env.example` contains placeholders only.

## Supabase initialization

1. Open the project's SQL Editor. Paste and run the complete contents of `supabase/migrations/202610130001_initial.sql`. This migration creates the tables, RPCs, RLS policies, profile trigger, and both storage buckets in one transaction. It is intended to run once on this new app's empty project. If it errors, do not partially copy sections or overwrite existing unrelated tables; check the error first.
2. Under Authentication URL configuration, set the Site URL to `http://localhost:3000` during local development. Allow `http://localhost:3000/auth/callback` (and `http://127.0.0.1:3000/auth/callback` if using that origin). Add the actual HTTPS production callback when deploying. Password recovery templates must retain Supabase's recovery URL and redirect support.
3. Keep email/password authentication enabled and Confirm Email disabled under the Email provider settings. Register `arrisnipshop@gmail.com` through `/register` and choose a password yourself. Signup logs in immediately; no email verification step is required. Never put the password in source or share it with the assistant.
4. Run `supabase/admin-setup.sql` separately in the SQL Editor. It grants administrator membership only to that registered account. Visit `/admin` after access is granted.
5. Open Payment Settings, upload the real permanent payment QR, and save clear instructions. Checkout remains disabled until a QR is configured.
6. Add real products and photos through Products. No products are seeded automatically.
7. Run `npm run check:supabase` to verify the catalog columns, singleton payment settings, and administrator role function are available. This is a read-only anonymous check; it does not verify authenticated isolation or create schema.

**Current checkout:** step 1 was completed on October 13, 2026 using the already-authenticated Supabase CLI. Do not rerun the initial SQL manually. The linked project is `spcuuigipezraflkmsaj` (`arrishop`). Remote tables, RLS, buckets, migration history, and anonymous catalog/settings access were verified. The user registered `arrisnipshop@gmail.com`; administrator membership was then granted with `supabase/admin-setup.sql` and verified remotely. Email signup is enabled and email confirmation was disabled at the user's request. Both the Management API and public Auth settings were checked after the change.

The public key cannot run SQL or provision administrator roles. Trusted setup requires SQL Editor or authenticated CLI access. No secret/service-role key is needed for the app.

## CLI migrations

This checkout includes generated `supabase/config.toml` for CLI/local development. It does not change the hosted project's authentication settings. Checkout-local link metadata lives under ignored `supabase/.temp`.

When setting up another checkout, sign in locally with `supabase login`, then link the intended project. For future schema changes, add a new migration rather than modifying or rerunning an already-applied migration:

```powershell
supabase link --project-ref spcuuigipezraflkmsaj
supabase db push --linked --dry-run
supabase db push --linked
supabase db query --linked --file supabase/verify-setup.sql
```

After registering the intended admin account, trusted provisioning can use:

```powershell
supabase db query --linked --file supabase/admin-setup.sql
```

The initial remote push succeeded. The CLI emitted a warning that its optional local migration-catalog cache could not be built because Docker Desktop was unavailable. Remote verification confirmed migration success; Docker is not required to run the Next.js app against hosted Supabase.

## Email confirmation setting

Email confirmation is disabled in both the local `[auth.email]` configuration and the hosted project. The Windows helper `scripts/set-email-confirmation.ps1` changes only `mailer_autoconfirm` through the Supabase Management API and verifies the result. It uses the already-saved CLI credential in memory without printing or writing it, and checks the linked project before updating it:

```powershell
./scripts/set-email-confirmation.ps1
```

Use this targeted helper or the dashboard's Confirm Email toggle for this setting; pushing the full local config may change unrelated hosted settings. Administrator membership still requires the trusted provisioning step. Supabase automatically marks new accounts confirmed when confirmation is disabled. Existing accounts created while confirmation was enabled may require separate handling.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run test:browser
```

The database tests run the real migration and RPCs in in-memory PostgreSQL via PGlite, with stubs for Supabase's Auth and Storage schemas. They cover price snapshots, checkout retries, ownership/RLS, internal-note isolation, receipt policies, required review fields, resubmission, and fulfillment transitions. They do not prove live Storage API behavior or simultaneous transactions across independent production connections.

Browser tests cover desktop/mobile catalog layout, the floating cart's position and navigation, forms, guest route protection, and invalid links. They work with populated or empty catalogs and use `http://localhost:3000` to match the dev server's origin. They use an installed Chrome/Edge on Windows when available. On another machine, run `npx playwright install chromium` if no browser is available. Results/screenshots are ignored by Git.

After setup, verify with two separate customer accounts and the administrator: registration with immediate login/password recovery, profile updates, available/unavailable products, cart quantities, checkout double submission and stale prices, QR display, private uploads, rejection/resubmission, amount confirmation, processing/completion, cancellation, filters, and private notes. Confirm that one customer cannot read another's orders/receipts even by direct API calls. Test simultaneous retries in separate sessions against Supabase.

## Vercel

Import this repository as a Next.js project. Configure all three environment variables for each intended deployment environment; set NEXT_PUBLIC_SITE_URL to that deployment's canonical origin. Add its exact `/auth/callback` URL to Supabase Auth's redirect allowlist. Build with `npm run build`. Do not commit local environment files or add a secret/service-role key to a public variable.

Before public launch, configure and test production email delivery in Supabase, verify the real QR recipient, settle delivery-charge/underpayment policies, and complete the live customer/admin checks above. The application has not been deployed by this change.

### Connecting arrie.store

The intended production domain is `arrie.store`; the website name is Arrie Store. The local Git remote is `https://github.com/b4didot/arrishop.git`. The repository and Supabase project identifiers do not need a rename to match the visible brand.

1. Commit and push the application source to the GitHub repository, excluding `.env.local` and ignored runtime files.
2. Create a new Vercel project by importing that repository, selecting Next.js, and using the repository root.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the local configuration, and set production `NEXT_PUBLIC_SITE_URL=https://arrie.store`. Configure appropriate values for any preview deployments used to test password recovery.
4. Deploy and check the generated `.vercel.app` URL, including products, accounts, cart, order creation, private receipts, and administrator operations.
5. In the new project's Settings → Domains, add `arrie.store` and confirm Move Domain from the current project if Vercel prompts. For projects in the same team, Vercel supports moving by adding to the destination without removing it from the source first. Check any related `www.arrie.store` redirect and follow the destination's DNS configuration if Vercel requests changes. See [Vercel's domain move instructions](https://vercel.com/docs/domains/working-with-domains/transfer-your-domain#transferring-domains-between-projects).
6. In Supabase Authentication URL configuration, use `https://arrie.store` as the production Site URL and allow `https://arrie.store/auth/callback` for password recovery. Keep localhost URLs allowed for local development.
7. Verify `https://arrie.store` and password recovery after the switch. The domain switch routes live visitors to the new app.

These instructions are a deployment plan. This rename does not publish code, move the domain, or change the hosted Supabase Site URL.
