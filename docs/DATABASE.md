# Database

The implemented schema is in `supabase/migrations/202610130001_initial.sql`. It was applied to the `arrishop` Supabase project (`spcuuigipezraflkmsaj`) on October 13, 2026 using the authenticated local CLI. Remote verification confirmed all ten application tables have RLS enabled, both storage buckets exist with the intended visibility, and migration `202610130001` is recorded. It also passes the local PostgreSQL/PGlite tests. It uses UUID primary keys, foreign keys, UTC `timestamptz`, integer centavos, and database constraints for valid values. Domain types live in `src/types/index.ts`.

| Table | Minimal fields and constraints |
| --- | --- |
| `profiles` | `id` references auth.users, full_name, phone, delivery_address, created_at, updated_at; email owned by Auth |
| `admin_users` | user_id references auth.users; managed only through trusted provisioning |
| `products` | id, title, description, price_centavos >= 0, image_path, out_of_stock, archived_at, created_at, updated_at |
| `cart_items` | customer_id, product_id, quantity > 0; unique customer/product |
| `orders` | id, unique order_number, customer_id, checkout_key, status, total_centavos >= 0, customer_name/phone/address snapshots, created_at, updated_at; unique customer/checkout_key |
| `order_items` | id, order_id, product_id, title snapshot, unit_price_centavos >= 0, quantity > 0; line totals derived from snapshots |
| `payment_submissions` | id, order_id, unique receipt_path, submitted_at, decision pending/confirmed/rejected, reviewed_by, reviewed_at, amount_received_centavos, rejection_reason; rejected requires nonblank reason; confirmed requires amount |
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

The private `receipts` bucket uses `customer UUID/order UUID/submission UUID.extension` paths. Upload policies check ownership and order state. Select policies allow the owning customer and administrators to read committed receipts, plus the owner to read their staged upload while the order accepts payment. Signed viewing URLs expire after five minutes. Neither customers nor administrators receive application update/delete policies for receipt files, including staged uploads; this prevents concurrent deletion during finalization. Failed finalization may leave private orphan files for a later trusted maintenance task. Do not delete files automatically when an RPC outcome is uncertain.

Both buckets limit files to 5 MB and JPEG/PNG/WebP. Server actions also inspect image signatures and MIME types. `submit_receipt` checks that the object exists before recording it. Duplicate finalization of the same order/path is idempotent.

## RPC contracts and limits

- `is_admin()` and `has_cart_product(uuid)` are read helpers; administrator membership itself has no public table grants.
- `set_cart_item(uuid, integer, boolean)` is the sole application cart mutation. Zero removes an item; quantities range from 1 to 99, with up to 100 different products per cart.
- `checkout(uuid)` takes only an idempotency key, not prices or totals. It requires complete delivery details and a configured QR. It returns an existing committed order before checking the now-empty cart on a retry.
- `submit_receipt(uuid, text)` records a stored receipt and moves the order to verifying_payment atomically.
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
