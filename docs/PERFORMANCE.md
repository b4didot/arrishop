# Performance investigation

The deployed baseline placed Vercel Node functions in Washington (iad1) while Supabase is in Seoul (ap-northeast-2). Authenticated requests then made sequential Auth, administrator-role, cart-count, and page-data calls across those regions. Adding a product also revalidated the root layout, rebuilding the storefront/header after the mutation.

A controlled check using a temporary customer account measured:
- Add to cart: 5015, 3957, 3933 ms (median 3957 ms).
- Account page: 6176, 1952, 2857 ms (first sample includes cold-load effects).
- Orders page: 2693, 2461, 2404 ms (median 2461 ms).

These are end-to-end observations from the execution client, not database execution times or a guarantee for every customer's network.

Implemented:
1. Colocate Node functions with the database in icn1. [Vercel region guidance](https://vercel.com/docs/functions/configuring-functions/region).
2. Replace the storefront cart server action/layout refresh with one focused, session-authorized JSON mutation and a confirmed badge update.
3. Remove administrator lookups from customer-only authorization; combine header role/cart reads and reuse server clients per request.
4. Batch private image signing and load independent report data concurrently.
5. Keep notification refreshes out of the blocking loading modal and pause their polling while hidden.

Recommended next steps:
- Recheck the admin's real phone/network after deployment, using warm navigation and a separate cold-load sample.
- If catalog reads remain noticeable, cache only the public catalog with explicit invalidation after product edits. Keep customer/order/receipt data private and uncached across users.
- If the report grows to thousands of orders, use virtual rows with continuous scrolling so the browser renders only visible rows while preserving the requested no-pagination experience.
- Consider cached JWT-claim verification only after reviewing the project's signing-key setup and revocation requirements; retain database role/ownership checks. [Supabase verification behavior](https://supabase.com/docs/reference/javascript/auth-getclaims).

The isolated performance account is removed after the after-deployment measurements. The release conversation records the before/after comparison; raw timing samples are kept only in ignored local validation artifacts.
