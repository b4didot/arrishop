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

The receipt form validates one or two selected photos with the lightweight size, MIME, and signature check, then uploads them directly from the browser to private Supabase Storage. This keeps two 5 MB images out of Vercel's function request body. The server action receives only the paths, validates ownership/order/submission naming, downloads each image, and uses Sharp to decode its pixels before calling the database RPC. The RPC verifies that every object exists and atomically records the one or two paths. No uploaded evidence is deleted on an uncertain finalization; retries reuse the same submission paths.

CheckoutForm owns the transient carrier choice and shows the resulting payment estimate. Its retry key also includes the carrier. The checkout RPC validates the choice and calculates shipping from server-owned policy, then stores the carrier and shipping charge on the order. Customer and administrator details render the same persisted order summary, so later policy changes cannot alter placed orders.

No service-role key is required by the application. Initial schema and administrator provisioning are trusted SQL Editor tasks. Failed receipt finalization can leave an orphaned private upload; the application does not delete receipts, preventing a delete/finalization race. Any maintenance cleanup must be a separate trusted operation after confirming the file is unreferenced.

The storefront leads directly with the live baked-goods catalog and retains its pastel visual style. Bakery-themed Lucide icons decorate the brand, placeholders, and auth page. Missing database configuration and empty catalogs show friendly unavailable/empty states without fabricated products or orders.

The server-rendered header supplies the fixed cart link and sums persisted cart quantities for its badge. Existing layout revalidation refreshes that count after cart/checkout mutations. `PaymentReview` owns only the transient confirm/reject choice; the existing server action and database RPC still own payment review. The administrator detail page shows review and subsequent fulfillment in a single panel based on the persisted order status.

`LoadingProvider` in the root layout owns transient UI request signals. Each pending source registers a React-generated identifier and removes its signal on completion or unmount; another pending request keeps the page locked. No persisted data or database rules are changed by loading states.

`AppLink` retains Next.js Link behavior and observes `useLinkStatus`. `ActionForm` reports `useActionState` pending; logout's `PendingForm` observes `useFormStatus`. Admin filters use `NavigationForm` with a router transition, and error retries report their transition. The route `loading.tsx` fallback bridges navigation into server-rendered page data loading. A CSS overlay supplies immediate fallback feedback before hydration; the shared native modal takes over after its signal registers.

The modal lives outside the inert application shell, traps focus, prevents Escape dismissal, locks scrolling, and restores focus when it closes. Passive link prefetch, image fetching, same-page anchor scrolling, and receipt links opened in another tab do not lock the current page. There is no global fetch interception or artificial minimum loading duration. Normal completion, action validation errors, redirects, and component cleanup release the relevant signals.

Local validation covers the production build, TypeScript, PostgreSQL logic/RLS via PGlite with Supabase schema stubs, and desktop/mobile Chromium browser tests. Live Auth, Storage API, and real simultaneous Supabase requests still require deployment setup and integration verification.

Production is hosted on Vercel in `brightly-os-projects/arrie-store`, connected to `b4didot/arrishop` with automatic deployments from `main`. `arrie.store` is canonical and `www.arrie.store` redirects to it. Hosted runtime configuration uses the existing Supabase project; local development retains its own localhost origin. Supabase's production Site URL and callback allowlist match these origins. Hosted build and guest browser checks pass; authenticated payment/recovery and simultaneous transaction checks are separate integration verification.


ProductEditor owns draft photos and primary selection. Authenticated browser uploads go directly to Supabase Storage under administrator RLS, avoiding Vercel request limits; the shared loading overlay covers upload and save together. saveProduct validates administrator access, new path product IDs, signatures, and collection size. Uncertain saves retain staged files to avoid deleting committed assets. ProductGallery owns modal/index state and uses a native dialog for focus trapping, scroll locking, and focus restoration.

Supabase Cron owns a daily synthetic Auth check at 04:00 UTC (12:00 Asia/Manila). `pg_net` sends a normal public Auth signup request using the publishable key; it never uses a privileged user-creation API. A separate 30-second cleanup job deletes only aged accounts with the dedicated synthetic email pattern and metadata marker, after checking that they have no orders. The job configuration stays in the private database schema. Neither scheduler is part of customer or administrator page rendering.


AddressFields shares the registration/account inputs. The server deliveryAddress validator owns trimming, limits, required fields, and four-digit ZIP validation. Profiles store delivery_address_parts JSON alongside the readable delivery_address. A database trigger synchronizes the readable address; the signup trigger copies validated Auth metadata to the profile. The checkout RPC checks completeness and snapshots both structured and readable addresses atomically. Order delivery parts remain independent of subsequent profile edits.

Social/Nickname follows the profile flow: registration metadata is copied by the signup trigger, account edits update the profile under its existing RLS policy, and checkout requires a nonblank value before snapshotting it on the order. The profile column remains blank for legacy accounts until they edit it, and for the synthetic Auth check that never places an order. Admin tables and order details read the order snapshot so later account edits do not change the name on an existing order.
