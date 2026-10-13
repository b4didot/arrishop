# Architecture

Next.js App Router renders the storefront and customer/admin pages. Tailwind styles reusable React controls. Supabase provides Auth, PostgreSQL, and Storage. Vercel hosts the application. No payment gateway or additional infrastructure is planned.

Server components load data; client components handle interactive cart controls, dialogs, and uploads. Server actions or route handlers validate input and sessions. Database RPCs own transactional checkout and status transitions. Route redirects improve navigation but do not replace server authorization or RLS.

Supabase owns persistent profiles, carts, products, orders, payment history, and settings. React owns transient form and loading state. Auth owns identity; a separate protected table owns administrator membership. Orders snapshot product pricing and delivery information. Current payment settings supply the permanent QR independently of order snapshots.

Use a request-scoped Supabase server client carrying the user's session so normal operations remain subject to RLS. Avoid service-role use in routine customer requests. Separate administrator-only data loading from customer payloads. Never serialize private notes or another customer's receipts into customer components.

Missing configuration must produce an honest setup message or clearly labeled development preview. Do not emulate successful authentication, order creation, or payment verification in production.

Code areas: `src/app` routes and server actions, `src/components` reusable UI, `src/lib/supabase/server.ts` request-scoped client, `src/proxy.ts` cookie refresh, `src/lib` validation/money/data/auth helpers, `src/types/index.ts` domain types, and `supabase/migrations` schema and policies. The old POS-specific `src/db/database.ts` requirement does not apply to this app.

Authentication is verified with `getUser` in pages/actions; the proxy refreshes sessions with `getClaims` and copies refreshed cookies/cache headers. React request caching avoids repeating viewer checks in the same render. Administrator layouts and each administrator page/action validate the database role independently.

Email confirmation is disabled in Supabase Auth. `signUp` returns a session for new registrations, and the signup action redirects directly to the storefront. Password recovery retains the email callback route. Administrator provisioning remains a trusted separate operation against the registered account; signup never sets roles.

`src/app/actions.ts` owns validated mutations and cache invalidation. The database serializes cart changes and checkout using a per-customer advisory transaction lock; it locks products while computing checkout. Receipt submission and payment/fulfillment changes lock the order row. Price/delivery snapshots belong to the order and remain stable when products/profiles change.

Checkout keys are retained in browser session storage per customer/cart fingerprint until the placed-order page clears them. The database unique constraint and RPC handle retries independently of the disabled submit button. Receipt upload paths use a stable submission key per form, and finalization accepts a retry for an already committed path.

No service-role key is required by the application. Initial schema and administrator provisioning are trusted SQL Editor tasks. Failed receipt finalization can leave an orphaned private upload; the application does not delete receipts, preventing a delete/finalization race. Any maintenance cleanup must be a separate trusted operation after confirming the file is unreferenced.

The storefront leads directly with the live baked-goods catalog and retains its pastel visual style. Bakery-themed Lucide icons decorate the brand, placeholders, and auth page. Missing database configuration and empty catalogs show friendly unavailable/empty states without fabricated products or orders.

The server-rendered header supplies the fixed cart link and sums persisted cart quantities for its badge. Existing layout revalidation refreshes that count after cart/checkout mutations. `PaymentReview` owns only the transient confirm/reject choice; the existing server action and database RPC still own payment review. The administrator detail page shows review and subsequent fulfillment in a single panel based on the persisted order status.

Local validation covers the production build, TypeScript, PostgreSQL logic/RLS via PGlite with Supabase schema stubs, and desktop/mobile Chromium browser tests. Live Auth, Storage API, and real simultaneous Supabase requests still require deployment setup and integration verification.
