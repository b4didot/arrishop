# Arrie Store

A small, cheerful e-commerce app built with Next.js, React, TypeScript, Tailwind CSS, and Supabase, ready for Vercel configuration. Customers browse, manage their cart, place orders, pay using a permanent QR, and submit private receipts. Administrators manage products, review payments, and fulfill orders.

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. Copy `.env.example` to `.env.local` for another checkout. The current checkout's public Supabase connection details are already configured and ignored by Git.

**Remaining Supabase setup:** the initial migration is applied to the linked `arrishop` project, email verification is disabled, and `arrisnipshop@gmail.com` has verified administrator membership. Configure password-recovery redirect URLs and upload the payment QR/add products in the dashboard. Follow [the complete setup guide](docs/SETUP.md). For a separate empty Supabase project, initialize it with the migration first, disable Confirm Email, and provision its administrator account.

- [Project rules](docs/RULES.md)
- [Features](docs/FEATURES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database and policies](docs/DATABASE.md)
- [Implementation plan and status](docs/IMPLEMENTATION_PLAN.md)

Checks: `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:browser`. Local checks do not replace the live Auth/Storage/customer isolation checks in the setup guide. The initial migration is deployed and verified; the website has not been deployed to Vercel.
