# Features

The following features are implemented in the application. Live use requires the Supabase migration, administrator provisioning, and payment QR setup described in SETUP.md.

- Public responsive storefront with product photos, descriptions, PHP prices, and visible out-of-stock badges. Unavailable products cannot enter the cart.
- Website branding is Arrie Store in the header, footer, browser titles, description, and customer completion message. The intended production domain is `arrie.store`.
- The baked-goods storefront opens directly to the catalog. The hero, benefits strip, ordering guide, promotional banner, and How to order navigation link have been removed. Bakery icons replace decorative flowers and generic product placeholders while retaining the existing palette and layout style.
- Supabase registration/login, password recovery, profile editing, and guest authentication redirect.
- Email verification is disabled. New registrations receive a session and return directly to the shop; no confirmation email or link is required. Password recovery still uses email.
- New passwords require 8–128 characters; spaces are preserved when setting or entering a password.
- Authenticated cart with quantities, removal, subtotals, and total.
- A fixed bottom-right cart button is visible across pages and scrolling, with a badge showing the sum of item quantities. Clicking it opens the existing cart page; guest login behavior is unchanged.
- Server-validated checkout with delivery review, unique order number, immutable pricing snapshots, and duplicate-submission protection.
- One global administrator-managed payment QR, friendly instructions, private receipt images, manual verification, rejection reasons, and repeat receipt submission on the same order.
- Customer order history, detail, status, receipts, and rejection feedback.
- Protected administrator overview, product/photo management, availability/archive controls, order search/filter/details, payment review with actual amount, private notes, and fulfillment status updates.
- Payment review and fulfillment share one administrator panel. Choose Confirm to enter the actual amount received, or Reject to enter a mandatory customer-visible reason. After confirmation, that same panel offers Start processing, then Mark completed. Payment status rules and confirmation dialogs are unchanged.
- Audit history for payment attempts and status changes; confirm important or destructive actions.

Payment lifecycle: Pending Payment, Verifying Payment, Payment Rejected, Payment Confirmed, Processing, Completed, Cancelled. Uploading a receipt never means payment succeeded.

Money displays in Philippine Peso and dates in Philippine local time. Excluded features remain excluded as listed in the supplied brief.

## Current behavior and limits

- Empty/unavailable catalogs display an honest coming-soon state. No demo products, fake receipts, or fake authenticated sessions are created.
- Cart quantities range from 1 to 99 per product, with up to 100 different products. Removing an archived/unavailable cart item remains possible.
- Checkout requires complete delivery details and a configured payment QR. It uses product prices from the database, ignores client totals, and clears the purchased cart atomically.
- The displayed order total consists of items only; no delivery surcharge or tax policy has been supplied.
- Confirmation requires an actual received amount covering the order total. Underpayment must be rejected with a customer-visible explanation; receipt resubmission stays on the same order.
- Administrators review a pending receipt before cancellation. Cancellation is permanent, requires a customer-visible reason, and does not initiate refunds.
- Order history and administrator order lists paginate by 20. Admin overview shows up to ten oldest orders awaiting review; its link opens the full filtered list.
- QR replacement affects current payment instructions for all orders. Payment submissions, order snapshots, and history remain preserved.
- Receipt links are private signed links that expire after five minutes; refresh the order page for new links.
- Product creation requires a photo. Products can be edited, made unavailable, archived, or restored. Replaced asset paths remain distinct.
- Forms disable repeated submission while pending, show errors/success feedback, and confirm order placement, receipt submission, payment review, fulfillment changes, cancellation, archival, and payment-setting changes.

Build, TypeScript, local database tests, and guest browser tests pass. Real email delivery, signed uploads, and a full authenticated customer/admin journey on Supabase remain to be verified after external setup.
