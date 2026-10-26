# Features

The following features are implemented in the application. Live use requires the Supabase migration, administrator provisioning, and payment QR setup described in SETUP.md.

- Public responsive storefront with product photos, descriptions, PHP prices, and visible out-of-stock badges. Unavailable products cannot enter the cart.
- Website branding is Arrie Store in the header, footer, browser titles, description, and customer completion message. The intended production domain is `arrie.store`.
- The baked-goods storefront opens directly to the catalog. The hero, benefits strip, ordering guide, promotional banner, and How to order navigation link have been removed. Bakery icons replace decorative flowers and generic product placeholders while retaining the existing palette and layout style.
- Supabase registration/login, password recovery, profile editing, and guest authentication redirect.
- Registration and My account offer an optional Social/Nickname for a pen name, handle, or other preferred name. New orders keep a snapshot of it, shown in checkout review, customer order details/history, and beneath the full name in administrator order tables and details; administrators can search orders by it. Older orders retain their original blank snapshot.
- Email verification is disabled. New registrations receive a session and return directly to the shop; no confirmation email or link is required. Password recovery still uses email.
- New passwords require 8–128 characters; spaces are preserved when setting or entering a password.
- Authenticated cart with quantities, removal, subtotals, and total.
- A fixed bottom-right cart button is visible across pages and scrolling, with a badge showing the sum of item quantities. Clicking it opens the existing cart page; guest login behavior is unchanged.
- Server-validated checkout with delivery review, unique order number, immutable pricing snapshots, and duplicate-submission protection.
- One global administrator-managed payment QR, friendly instructions, private receipt images, manual verification, rejection reasons, and repeat receipt submission on the same order.
- Each payment submission requires one receipt photo and accepts an optional second photo, with a strict maximum of two. Each photo can be a JPG, PNG, or WebP up to 5 MB. Both photos appear in customer and administrator payment history. Order placement still precedes payment and receipt submission.
- The browser checks size, stated format, and file signature before sending each photo directly to private Storage. The server downloads and fully decodes every stored photo before finalizing payment submission; malformed or truncated files stay out of payment review.
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
- Checkout requires a carrier choice before the order is placed. J&T (JNT) adds a fixed ₱99 shipping line to the amount paid through the shop QR. Lalamove shipping is paid separately by the customer and is excluded from the shop payment total. The selected carrier and charge appear in customer and administrator order details.
- Confirmation requires an actual received amount covering the order total. Underpayment must be rejected with a customer-visible explanation; receipt resubmission stays on the same order.
- Administrators review a pending receipt before cancellation. Cancellation is permanent, requires a customer-visible reason, and does not initiate refunds.
- Order history and administrator order lists paginate by 20. Admin overview shows up to ten oldest orders awaiting review; its link opens the full filtered list.
- QR replacement affects current payment instructions for all orders. Payment submissions, order snapshots, and history remain preserved.
- Receipt links are private signed links that expire after five minutes; refresh the order page for new links.
- Product creation requires a photo. Products can be edited, made unavailable, archived, or restored. Replaced asset paths remain distinct.
- Forms disable repeated submission while pending, show errors/success feedback, and confirm order placement, receipt submission, payment review, fulfillment changes, cancellation, archival, and payment-setting changes.
- Pending page navigation and data actions display a centered cream rectangle with a spinner and the two-word message “Please wait.” A subtle backdrop and modal focus prevent interaction with the page while loading; scrolling is locked and Escape does not dismiss the loader.
- Loading coverage includes customer/admin navigation and pagination, authentication and password recovery, profile edits, cart changes, checkout, receipt/product/QR uploads, product availability/archive edits, payment decisions, fulfillment/cancellation, internal notes, logout, admin order filters, and error-page retries. The loader clears after completion or failure so normal validation/error feedback remains usable.

Build, TypeScript, local database tests, and guest browser tests pass. Real email delivery, signed uploads, and a full authenticated customer/admin journey on Supabase remain to be verified after external setup.


Administrators can add, replace, or remove up to three product photos with immediate previews. Make primary chooses the storefront photo; Save product saves the selection. At least one photo is required. Customers click a photo to open a responsive viewer with side arrows and an X, without thumbnails. Keyboard arrows, Escape, and touch swipes work too.

The customer photo viewer uses the viewport without a cream card. Photos retain their proportions and have rounded corners directly against the dimmed backdrop. Compact arrows sit outside the photo's left and right edges, and X sits above its top-right corner. Space for the controls keeps them visible on mobile without covering the photo.


Registration and My account group six fields under Delivery address: Street Address, optional Subdivision / District / Landmark, Barangay, City / Municipality, Province / Region, and a required four-digit ZIP Code. ZIP codes are text so leading zeros are preserved. Checkout requires all mandatory fields; existing customers complete the new fields in My account without their previous address being guessed or discarded. Checkout and order details label each part for delivery booking. Existing orders retain their original address snapshots.

Storefront product cards anchor their price and purchase controls at the bottom, aligning them across each grid row regardless of title or description length on desktop and mobile. Descriptions remain fully visible.

The floating cart stays inside the bottom-right edge of the mobile viewport, including its item-count badge, without widening the page or creating sideways scrolling.

The mobile viewport does not scroll sideways on admin pages; wide order tables scroll within their own panels while the floating cart remains anchored to the viewport. Admin order lists show Status, Customer, Total, Order Number, and Placed in that order. Each status opens the order detail; the separate Open order link has been removed.

## Delivery, feedback, messages, and preparation report (October 25, 2026)

- Delivery calendar at /admin/calendar: dates are closed until explicitly opened; each has a positive maximum order count. Default capacity starts at 10 and minimum lead time at two calendar days, measured in Asia/Manila. Defaults can be changed; each configured date retains its own capacity.
- Checkout requires an open, non-full delivery date meeting lead time. Checkout itself does not reserve capacity. The first successfully submitted payment receipt reserves one slot immediately, including while awaiting review. Rejection and resubmission keep it. Only administrator cancellation releases it.
- An unreserved order's delivery date can be changed before submitting payment evidence. Availability is checked again at submission; if the date filled since checkout, choose another before paying. Customers cannot move reserved orders. Administrators can assign an available date to a historical reserved order with no recorded date.
- Completed orders accept one private review: optional overall text, optional comment per unique product, and zero to five photos total. No public review page or ratings are added.
- Each order has a private customer/shop conversation, separate from payment rejection reasons. Each message allows text and/or up to three photos. Refresh messages retrieves replies; there are no read receipts, typing indicators, or notifications.
- Review/message photos support JPG, PNG, and WebP up to 5 MB each; Take photo requests the phone's camera where supported. All photos remain private and server-decoded.
- Chat becomes a read-only administrator archive at 10 days after completion. At 70 days after completion, messages and chat photos lose application access; the daily maintenance job physically deletes them, normally within the next 24 hours. Reviews and payment receipts have their own retention and are not deleted with chat.
- /admin/report supplements the existing Orders page. Its default scope is every reserved, non-cancelled order, including receipts awaiting review and rejected payments. All orders can also be shown.
- Each product has a positive item count (default 1). Order items snapshot that count; suggested preparation count is ordered quantity times the snapshot. Administrators may override individual order-item report counts, including zero, or restore suggestions after a confirmation dialog. Product quantities, totals, and product settings remain unchanged by report overrides.
- Report columns include delivery day/date, name, social, status, quantity/count pairs for every product, address, phone, and total. Columns can be moved, hidden, sorted, and filtered by name/social/order number, date range, and weekday. Preferences persist per administrator on the current browser/device. Results use continuous scrolling without pagination.
- Phone report controls adjust table size from 55% to 125%, with horizontal scrolling and a pinned Name column. Status buttons ask for confirmation before opening the order.

Desktop page containers, navigation, and footer now use the available viewport width with 32 px side gutters instead of fixed 1200/1280 px caps. Desktop authentication and account/settings panels also expand to their container width. Existing mobile/tablet breakpoints at 800 px and below retain their spacing, stacked layouts, and contained table scrolling.
## Report, notifications, and responsiveness update

- Order Report shows every matching order in a continuous scrolling table. Numbers are centered; complete cell/header text wraps. Drag header separators (keyboard arrows also work) or use width sliders under Customize columns. Widths, order, visibility, and zoom are saved per administrator/device.
- Order messages have explicit spacing after the order/payment summary. Delivery-calendar guidance appears above its grid and the selected date below it.
- Signed-in customers and administrators have a private notification bell for messages, status changes, and delivery-date changes. The sender does not receive their own event. Unread counts refresh every 30 seconds while visible and on focus; viewing an order refreshes its content when a new notification arrives. Notifications can be marked read individually or together. These are in-app alerts, as requested; closed-app/email/push delivery is not included.
- Loading indicators use a dedicated rotation animation; reduced-motion mode uses slower, discrete steps rather than the global no-animation rule.
- Add to cart uses a focused JSON request, returns the database-confirmed badge count, and invalidates cart/checkout data without rebuilding the current storefront. Authorization and cart validation still occur in the database.
- The 21 older undated orders were assigned October 1, 2026, preserving existing timestamps and all orders with a concrete delivery date. The explicitly requested ARRI-00000028 and its four attached photos were removed after a private backup.
