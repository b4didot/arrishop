# Project rules

This repository is Arrie Store, an online baked-goods store. It is unrelated to Brightly POS; POS-specific offline and persistence rules do not apply.

- Read this file and the relevant project documentation before changing code.
- Use Next.js, React, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL/Storage, and Vercel.
- Keep changes scoped, dependencies minimal, and customer language simple.
- Update FEATURES.md for user-facing changes, ARCHITECTURE.md for architecture or state ownership, DATABASE.md for persisted data, and setup documentation for development workflow changes.
- Validate authentication, administrator authorization, quantities, availability, and money on the server. Enforce database access with RLS.
- Keep receipts private and administrative notes inaccessible to customers.
- Use integer centavos for money and PHP for display. Store UTC timestamps and display them in Asia/Manila.
- Never commit credentials. Never put service-role credentials in client code.
- No automated payments, quantity inventory, discounts, or variants. Delivery scheduling, private post-order reviews, order messaging, and an administrator Order Report are authorized features.
- Implement in working milestones with checks appropriate to each change.

The companion documents describe the implemented application and identify external setup and verification still pending.
