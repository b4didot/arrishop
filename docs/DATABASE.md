# Database

The implemented schema is in `supabase/migrations/202610130001_initial.sql`. It was applied to the `arrishop` Supabase project (`spcuuigipezraflkmsaj`) on October 13, 2026 using the authenticated local CLI. Remote verification confirmed all ten application tables have RLS enabled, both storage buckets exist with the intended visibility, and migration `202610130001` is recorded. It also passes the local PostgreSQL/PGlite tests. It uses UUID primary keys, foreign keys, UTC `timestamptz`, integer centavos, and database constraints for valid values. Domain types live in `src/types/index.ts`.

| Table | Minimal fields and constraints |
| --- | --- |
| `profiles` | `id` references auth.users, full_name, social_name (optional), phone, delivery_address, created_at, updated_at; email owned by Auth |
| `admin_users` | user_id references auth.users; managed only through trusted provisioning |
| `products` | id, title, description, price_centavos >= 0, image_path, out_of_stock, archived_at, created_at, updated_at |
| `cart_items` | customer_id, product_id, quantity > 0; unique customer/product |
| `orders` | id, unique order_number, customer_id, checkout_key, status, total_centavos >= 0, delivery_carrier, shipping_fee_centavos, customer_name/social_name/phone/address snapshots, created_at, updated_at; unique customer/checkout_key |
| `order_items` | id, order_id, product_id, title snapshot, unit_price_centavos >= 0, quantity > 0; line totals derived from snapshots |
| `payment_submissions` | id, order_id, unique receipt_path (first photo), receipt_paths (one or two), submitted_at, decision pending/confirmed/rejected, reviewed_by, reviewed_at, amount_received_centavos, rejection_reason; rejected requires nonblank reason; confirmed requires amount |
| `order_admin_details` | order_id primary key, notes, updated_at; administrator-only |
| `order_status_history` | id, order_id, previous_status, next_status, actor_id, reason, created_at; append-only |
| `payment_settings` | singleton id, qr_path, instructions, updated_by, updated_at |

## Status transitions

`pending_payment -> verifying_payment -> payment_confirmed -> processing -> completed`

`verifying_payment -> payment_rejected -> verifying_payment`

Administrator cancellation is allowed from nonterminal statuses after any pending receipt has been reviewed. An order in verifying_payment must first be confirmed or rejected, so cancellation never strands a pending review. Cancelled and completed are terminal. Customer receipt submission is allowed only from pending_payment or payment_rejected. Confirm/reject applies only to the current pending submission on an order in verifying_payment. Review locks the order to prevent simultaneous conflicting decisions.

## Transactions and policies

- Checkout is a database transaction exposed through an authenticated RPC: validate the caller, lock/read products and cart, reject empty or unavailable products and invalid quantities, calculate prices from products, insert order/items/history, and clear purchased cart entries only on success.
- Use a client-generated checkout key retained across network retries and a unique database constraint. Look up a previously committed order before requiring the cart again. Handle concurrent retries without creating duplicate orders.
- Order numbers come from a database sequence, with a friendly prefix. They are identifiers, not access credentials.
- Customers read public nonarchived products and payment settings, manage their own profiles/carts, and read their own orders/items/payment submissions/status history. They cannot directly insert or alter order totals, statuses, reviews, or history.
- Administrator policies use a database-backed role check. No customer can promote themselves. Sensitive RPCs check roles even if invoked outside the UI.
- Security-definer RPCs require explicit caller checks, restricted grants, and a fixed safe search path.
- Keep notes in an admin-only table: row-level filtering alone does not hide a column from an otherwise readable order row.
- Preserve orders, product snapshots, and receipt attempts when products are archived. Do not delete historical commerce records through normal product management.

## Storage

The public `shop-images` bucket stores product photos and the payment QR, with administrator-only insert permissions. Images are versioned by unique paths; there is no overwrite policy. Administrators can delete only files unreferenced by products/settings.

The private `receipts` bucket uses `customer UUID/order UUID/submission UUID-photo number.extension` paths for new submissions. Upload policies check ownership and order state. Select policies allow the owning customer and administrators to read both committed receipt photos, plus the owner to read staged uploads while the order accepts payment. Signed viewing URLs expire after five minutes. Neither customers nor administrators receive application update/delete policies for receipt files, including staged uploads; this prevents concurrent deletion during finalization. Failed finalization may leave private orphan files for a later trusted maintenance task. Do not delete files automatically when an RPC outcome is uncertain.

Both buckets limit files to 5 MB and JPEG/PNG/WebP. Server actions also inspect image signatures and MIME types. `submit_receipt` checks that the object exists before recording it. Duplicate finalization of the same order/path is idempotent.

## RPC contracts and limits

- `is_admin()` and `has_cart_product(uuid)` are read helpers; administrator membership itself has no public table grants.
- `set_cart_item(uuid, integer, boolean)` is the sole application cart mutation. Zero removes an item; quantities range from 1 to 99, with up to 100 different products per cart.
- `checkout(uuid, text)` takes an idempotency key and a required carrier (`jnt` or `lalamove`), not prices or totals. It requires complete delivery details and a configured QR. It calculates the product subtotal and adds 9900 centavos for J&T or zero for Lalamove, then snapshots the carrier and shipping charge on the order. It returns an existing committed order before checking the now-empty cart on a retry. The old `checkout(uuid)` signature supports committed retries only and rejects new orders until the client selects a carrier.
- `submit_receipt(uuid, text, text)` records one or two stored receipt photos and moves the order to verifying_payment atomically. The old two-argument form remains a single-photo compatibility wrapper.
- `review_payment(uuid, uuid, boolean, bigint, text)` requires an administrator, a current pending receipt, a recorded amount covering the total for confirmation, or a nonblank rejection reason.
- `advance_order(uuid, text, text)` permits only defined fulfillment transitions and cancellation with a nonblank reason.
- Product prices are limited to 100,000,000 centavos (PHP 1,000,000); order/received amounts are bounded to safe integer totals.

All security-definer functions fix their search path and have explicit execution grants. Normal customers have select-only grants on order, receipt, history, and cart tables. Internal notes reside in an administrator-only table. Archive products instead of deleting them.

`supabase/admin-setup.sql` provisions the registered account `arrisnipshop@gmail.com`. Run it through the SQL Editor or authenticated CLI after registering that account; email matching alone never grants access through application code. The setup script no longer requires email verification. Hosted Auth auto-confirms new accounts, but administrator access still comes from the separate protected membership table.

`supabase/verify-setup.sql` provides a read-only summary of deployed tables/RLS, buckets, migration history, and intended administrator readiness. After the user registered `arrisnipshop@gmail.com`, administrator provisioning was completed and the remote check returned `admin_account_exists = true` and `admin_access_granted = true`.

Administrator membership was also granted to the existing account `johnallenarias.pm@gmail.com` at the user's request and verified remotely. The bootstrap script remains scoped to the original shop account; additional administrators are granted membership through trusted provisioning, never public signup.


Migration 202610130002_product_photos.sql adds products.image_paths (non-null text array, up to three paths), backfilled from existing image_path. image_path remains the primary for compatibility with deployed code. The constraint requires the primary to belong to the gallery, forbids null entries, and allows empty legacy records only with a null primary. Storage cleanup protects all gallery images.

Gallery migrations 202610130002 and 202610130003 were applied to the linked Supabase project with user authorization. The compatibility trigger backfills a collection for inserts or photo replacements from the currently deployed single-photo editor; selecting an existing gallery primary preserves the collection. Gallery saves still enforce the collection constraint.

## Authorized data reset

For the October 13, 2026 launch reset, the owner requested removal of all orders and all Auth users except `johnallenarias.pm@gmail.com` and `arrisnipshop@gmail.com`. This is a one-time administrative operation, not a migration or an application feature. Delete order items, payment submissions, internal order notes, and status history before orders in one transaction; remove the unwanted Auth users and their cascading profiles, carts, identities, and sessions. Preserve both retained accounts and administrator memberships, products/photos, payment settings, and the order-number sequence. Remove obsolete receipt files through the Storage API rather than deleting storage metadata directly. Verify remaining counts and retained administrator access afterward.


Migration 202610130004_delivery_address_parts.sql adds non-null delivery_address_parts JSONB to profiles and orders, defaulting to an empty object for existing records. Keys: street_address (1-300 chars), subdivision (optional, up to 200), barangay/city/province (1-100 each), zip_code (four ASCII digits stored as text). Constraints validate complete nonempty objects; empty legacy objects retain original delivery_address. Checkout rejects incomplete structured profiles and snapshots both representations. Existing addresses are preserved rather than parsed heuristically. Signup copies the structured metadata; profile updates derive the formatted address through a trigger. Existing RLS/grants remain in place.

This migration was applied to the linked Supabase project on October 13, 2026 with the owner's authorization for local testing. Code rollout is pending; the live account form must be updated before existing accounts can complete the structured address for checkout.

Migration `202610130005_synthetic_auth_check.sql` adds a private configuration table and two restricted functions, enables `pg_cron` and `pg_net`, and schedules the synthetic signup and cleanup jobs. The signup job uses the same public `/auth/v1/signup` HTTP API as a customer, with randomized credentials and metadata marking it as synthetic. The account receives only a normal customer profile; it never creates a cart or order. Cleanup requires the synthetic email pattern, marker, age of at least two minutes, and no orders. The 30-second polling interval means deletion normally occurs within 30 seconds after the two-minute age threshold. The daily schedule is 04:00 UTC, equal to 12:00 Philippine time year-round.

Migrations `202610130005` and `202610130006` were applied to the linked project. `202610130006` uses built-in `gen_random_uuid()` for the random password because the project's `pgcrypto` byte-generation function was unavailable on the restricted function search path. A manual live invocation returned Auth HTTP 200, created the marked customer/profile, and the scheduled cleanup deleted both after two minutes; the two real administrator accounts remained.

Migration `202610130007_delivery_carriers.sql` adds `orders.delivery_carrier` and `orders.shipping_fee_centavos`. Legacy orders retain a null carrier and zero fee. A constraint permits only J&T with 9900 centavos or Lalamove with zero for new carrier-tagged orders, and requires totals to cover the shipping charge. The checkout RPC calculates the charge from the selected carrier inside the transaction, so submitted client totals cannot change it. Lalamove's external shipping fee is intentionally not part of the shop order total. Product rows remain in `order_items`; shipping is an order-level charge line rendered from the saved snapshot.

Migration `202610130007` was applied to the linked Supabase project on October 13, 2026 before the matching application deployment.

Migration `202610130008_social_names.sql` adds optional social names to profiles and order snapshots. Both default to an empty string for existing records and have a 120-character limit. The signup trigger copies and trims the name from Auth metadata; checkout snapshots the current profile value. Existing orders remain blank rather than inferring a name from a later profile edit. Existing profile RLS and order read grants still apply.

Migration `202610130008` was applied to the linked Supabase project on October 13, 2026; remote schema verification confirmed both new columns and their blank defaults.

Migration `202610130009_required_social_nickname.sql` requires a nonblank profile `social_name` inside the checkout RPC before any new order is created. Legacy profiles and orders retain blank values until the customer updates the profile; committed checkout retries still return the existing order. This keeps the synthetic Auth check compatible, since its temporary account never orders. The existing profile and order columns and RLS policies are unchanged.

Migration `202610130009` was applied to the linked Supabase project on October 13, 2026 before the matching application deployment.

Migration `202610130010_receipt_photos.sql` adds `payment_submissions.receipt_paths`, backfilled from each existing `receipt_path`. The array must contain one or two distinct non-null paths, beginning with the legacy-compatible `receipt_path`. The updated read helper covers every photo in the array. The three-argument submission RPC checks ownership, distinct paths, and Storage existence for every photo before updating order status; its two-argument wrapper preserves single-photo clients during rollout. Receipt files stay private and immutable under the existing Storage policies.

Migration `202610130010` was applied to the linked Supabase project on October 13, 2026. Remote verification found six existing submissions backfilled and no invalid photo counts.

## Migration 202610250001: order workflows

This migration is applied to hosted arrishop; see the hosted verification and staged activation notes below.

- delivery_settings: singleton lead_days (0–365; default 2) and default_capacity (1–10000; default 10).
- delivery_days: explicit delivery_date primary key, is_open, positive capacity. Unconfigured dates are closed. Authenticated customers may read availability; only administrators change settings/dates. Customer-visible availability exposes aggregate counts, never other customers' orders.
- orders: nullable delivery_date, slot_reserved_at, completed_at. Existing receipt-bearing orders are backfilled as reserved; historical delivery dates remain unknown rather than guessed. Existing completed orders derive completion time from status history, falling back to updated_at.
- products.item_count and order_items.item_count: 1–10000, default 1. An insert trigger snapshots the current product multiplier. Historical line items default to 1.
- order_items.report_count: optional administrator override, 0–10000000. Null restores quantity × snapshotted item_count.
- order_reviews: one per order, customer identity, overall text (up to 5000), product-ID-keyed item_reviews (each comment up to 3000), up to five photo_paths total, creation timestamp. Submit RPC checks completion, ownership, ordered products, photos, and retries. Select policies expose reviews only to owner/administrators.
- order_messages: immutable UUID-keyed entries with order, sender, administrator flag, text (up to 3000), up to three photo_paths, timestamp. Text can be empty when photos exist. Sender identity/role comes from Auth/database state. Direct customer/admin writes are revoked.
- Private order-media bucket: immutable review/message photos under uploader UUID/order UUID/kind/entry UUID-index.extension. JPG/PNG/WebP, max 5 MB. Policies enforce ownership, review eligibility, conversation windows, and access to finalized/staged paths. No application delete/update policies.

checkout(uuid,text,date) requires an available delivery date while preserving retries. checkout(uuid,text) preserves the deployed undated flow only while the staged rollout gate is false; after activation it permits committed retries only. The one-argument compatibility function remains retries-only. Social/Nickname becomes optional again. set_order_delivery checks ownership and reservation state. check_delivery_day is internal and has no client execution grant.

submit_receipt retains its existing contracts and evidence validation; its insert trigger atomically reserves the first slot, with a shared calendar lock. Rejected evidence keeps the reservation. Existing administrator cancellation rules remain: review a pending receipt first, then cancel. Completed orders continue counting toward their delivery date's capacity.

submit_order_content validates review/message type, owner/admin access, UUID retry keys, content bounds, distinct photos, scoped filenames, and object existence. Clients cannot change sender identity or publish reviews. order_chat_access hides customer messages and photos at completion +10 days, and administrator access at +70 days. Already-issued signed URLs can remain usable for their remaining five-minute lifetime.

expired_order_chat_photos and purge_expired_order_messages have execution grants only for the service role. The daily maintenance endpoint removes Storage objects through the Storage API before deleting expired rows, including photo-less messages. It never deletes storage metadata directly. Unexpired staged uploads and review/receipt assets are retained. Review/media retention is independent of chat retention.

Slot/settings changes serialize in PostgreSQL. The local PGlite tests validate rules and rollbacks but do not simulate concurrent independent Supabase connections; verify the last-slot race with two customers during staging acceptance.

## Hosted migration verification — October 25, 2026

Applied migration 202610250001_order_workflows.sql to the existing arrishop project (spcuuigipezraflkmsaj) with the owner's explicit authorization. Remote migration history matches local history through this version. Verified all four new tables have RLS, order-media is private with 5 MB JPG/PNG/WebP limits, cleanup is denied to customers and allowed to the service role, and both checkout entry points have the intended grants. Reservation/completion backfills have zero invalid rows.

The pre/post application snapshots match all original fields and row counts across ten application tables, including 21 orders, 6 products, and 20 payment submissions. Historical updated_at values were preserved by disabling only the order_updated trigger during the transactional backfill, then restoring it. Snapshots and comparison scripts are in ignored supabase/.temp/migration-backups/202610250001; do not commit or share their customer data.

To allow applying this migration before deploying the new UI, delivery_settings.enforce_delivery_dates starts false. The existing two-argument checkout is preserved as a private checkout_before_calendar helper and is used only by the compatibility wrapper while this flag is false. Undated receipt submissions also remain compatible during this rollout window. The new three-argument checkout always validates its delivery date and capacity.

After the matching application is deployed and delivery dates are opened, activate strict enforcement with a trusted SQL operation:
```sql
update public.delivery_settings set enforce_delivery_dates = true where id = 1;
```
After activation, the old entry point permits only committed retries and unreserved undated orders must choose a date before receipt submission. The legacy helper is not executable by customers. Do not enable the gate while the old checkout is still deployed. The migration does not itself deploy the website, open dates, or configure the cleanup secrets/job.

All 32 local automated tests pass, including compatibility before activation and strict reservation checks after activation. Physical-phone camera, hosted Storage behavior, independent-connection last-slot races, and scheduled cleanup still require deployment acceptance.

## Migration 202610250002

Applied to the linked arrishop project. This adds order_notifications (recipient, order, unique event key, kind, order number, optional status, created/read timestamps) with RLS and owner-only SELECT. Only restricted inbox/read RPCs permit acknowledgement; customers cannot edit another recipient's alerts or forge events. Trigger-generated events cover order status history, messages, and actual delivery-date changes, excluding the actor and deduplicating recipients. The historical delivery-date backfill runs before those triggers so it does not create a flood of old alerts.

notification_inbox returns the latest 30 event summaries and an accurate total unread count. read_order_notifications accepts an optional event UUID or an upper timestamp for marking existing alerts read. Both functions require an authenticated caller and filter by auth.uid().

change_cart_item retains set_cart_item's validation and per-customer advisory lock, returning the total persisted quantity in the same transaction. viewer_context returns only the caller's admin membership and cart quantity. All new client RPC execution grants are authenticated-only.

Historical NULL delivery_date values were filled with 2026-10-01, with order_updated disabled only during that transaction to preserve commerce timestamps. Concrete existing dates were untouched.

The owner's one-time request to remove ARRI-00000028 was handled separately from migrations. Its exact UUID was verified and its data/four photos backed up in ignored supabase/.temp/order-report-release. Related rows and the order were deleted in one guarded transaction; photos were removed through the Storage API. Verification found zero matching orders or attached files and 21 remaining orders. The order number sequence was preserved.
