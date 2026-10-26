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

No service-role key is required by ordinary customer/admin requests; scheduled expired-chat cleanup uses a server-only service-role key. Initial schema and administrator provisioning are trusted SQL Editor tasks. Failed receipt finalization can leave an orphaned private upload; the application does not delete receipts, preventing a delete/finalization race. Any maintenance cleanup must be a separate trusted operation after confirming the file is unreferenced.

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

## Order workflows added October 25, 2026

Migration 202610250001_order_workflows.sql owns delivery availability, reservation enforcement, snapshotted preparation counts, private reviews/messages, and completion timestamps. A shared database advisory transaction lock serializes calendar changes and reservation checks. The payment-submission trigger reserves capacity inside the same transaction that records the receipt; a failure rolls back both. Reservations are counted when slot_reserved_at is non-null and status is not cancelled. Calendar closure never discards existing reservations.

The new three-argument checkout RPC validates the delivery date and retains the existing per-customer retry lock, server pricing, and immutable order snapshots. The previous two-argument signature delegates to a private preserved implementation while delivery_settings.enforce_delivery_dates is false, preserving the currently deployed checkout. Enable the gate after deploying the new UI and opening dates; the old signature then permits only committed retries. Undated receipt submissions have the same rollout compatibility gate. Order dates remain editable only before reservation, except an administrator may schedule an undated historical reserved order. Configured capacity cannot fall below current reservations. The selected date is part of the browser's checkout retry fingerprint.

workflow-actions.ts validates sessions and inputs; mutations remain protected by RLS and restricted RPCs. order-workflows.ts loads calendar availability, conversations, reviews, and five-minute signed photo URLs. OrderContentForm owns drafts and browser-to-Storage uploads; the server downloads and decodes photos before the transactional submit_order_content RPC. The review stores product-keyed comments so quantity does not duplicate review fields. Entry UUIDs provide idempotent retries. Uploaded objects are immutable; uncertain finalization retains them.

order_chat_access enforces the 10-day customer/writing and 70-day administrator reading windows at the database and Storage-policy layers. Archived messages stay in the same table as read-only logs, retaining sender identity, timestamp, and photos. No separate archive copy or realtime service is required. The maintenance route authenticates CRON_SECRET, then uses a server-only service-role client to remove expired message photos through the Storage API before purging message rows. Its restricted candidate RPC includes staged message photos for completed, expired orders. Failed deletions retain message rows for retry. Scheduled deletion requires hosting secrets; normal user requests still use session clients and do not require a service-role key.

OrderReport owns column preferences, sorting, filters, continuous row display, sizing, and confirmation dialogs. It receives authenticated administrator-only data. Server loaders page through records explicitly to avoid the default API response cap; the report currently loads matching data into the browser for local sorting/filtering and is intended for this small shop. Revisit server-side report queries if order volume becomes large. Product counts are snapshotted on insert and report overrides are separate from sales quantities/prices.

Authenticated browser checks use an isolated local Supabase-shaped API fixture and actual Next.js routes/actions on port 3107. They validate UI behavior, not live Supabase integration or production concurrency. Database tests apply the actual migration in PGlite and verify authorization, reservation lifecycle, review limits, retention access, and restricted cleanup.

## Notifications and latency reduction

Migration 202610250002_notifications_and_cart adds recipient-private order_notifications, event triggers for status history/messages/delivery changes, a notification inbox/read RPC, and two small session-scoped aggregate RPCs. Notification rows contain generic event metadata rather than message text or private notes. Events are inserted in the same transaction as their source update; recipients include the order owner and administrators, excluding the actor. Customers have no direct notification write grant.

NotificationBell polls the lightweight /api/notifications endpoint while the document is visible and on focus, without registering the global loading lock. New events for the currently open order request a router refresh. Read mutations validate same-origin requests and are limited by the database to the authenticated recipient.

getAuthenticatedUser remains a request-cached, server-verified Auth lookup. requireUser no longer performs an unnecessary administrator check. getViewer shares that lookup and fetches admin membership plus the persisted cart badge in one viewer_context RPC. Supabase server clients are cached only within the React request; no private user data is shared across sessions.

The product AddToCart client calls POST /api/cart. The handler checks Origin and UUIDs, then invokes change_cart_item using the request's Supabase session. This RPC delegates to the existing advisory-lock-protected cart mutation and returns its total quantity. JWT verification and ownership are enforced by Supabase. revalidatePath in the route handler invalidates cart and checkout on their next visit without forcing a storefront RSC/layout render. CartLink receives successful confirmed counts through a small browser event; errors never increment it. API handlers refresh cookies using their own session client and bypass the proxy's redundant Auth request; they authorize through restricted database RPCs.

Receipt and conversation photo URLs are signed in batches. Report catalog/orders load concurrently, and availability uses explicit internal API chunks to avoid the response cap. The visible report has no pagination.

Production functions are configured in Seoul (icn1), matching the Supabase ap-northeast-2 database. This removes repeated cross-Pacific server/database trips while static assets remain CDN-served. Private pages remain dynamic and private.

## Admin order controls

AdminOrderControls posts status, date or archive/restore to a separately authorized Server Action and admin_update_order RPC. Raw updated_at is passed unchanged to preserve PostgreSQL timestamp precision for optimistic concurrency. Status/date reasons appear in public history; archive notes and the full change audit stay administrator-only. Each operation has a confirmation. Normal payment review and quick fulfillment remain available.

Active admin lists and overview query archived_at IS NULL; the orders page offers archived/all views and the report applies the same scope locally. Customer queries and capacity counts deliberately include archived orders. Receipt history renders superseded reviews distinctly from rejected payments. Reopening preserves the original completed_at used by database and Storage chat-retention policies.
