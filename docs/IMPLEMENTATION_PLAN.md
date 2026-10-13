# Implementation plan

## Scope and decisions

Build a small customer storefront and administrator dashboard using Next.js App Router, TypeScript, Tailwind CSS, Supabase, and Vercel. Visitors can browse; authentication is required for carts and orders. Payments use one administrator-configured QR image and manual receipt review.

The repository initially contains only Git metadata. No existing application, schema, configuration, or project documentation is available to preserve. The user confirmed that this is a new application unrelated to the earlier POS instructions.

## Inputs and assumptions

- Arrie Store is the confirmed website name, with `arrie.store` as the intended production domain. Keep the existing cream, peach, lilac, and green visual theme.
- Products use an availability toggle, without quantity inventory or variants.
- The total is the sum of item prices multiplied by quantities. No shipping fee, tax rule, or surcharge was specified; do not invent one. Confirm these before launch.
- Customers provide name, email, phone, and delivery address. Use email/password authentication with email confirmation disabled, as requested by the user; registration logs in immediately.
- Only administrators cancel orders in the initial workflow. Cancellation is available before completion and requires confirmation and an audit reason. It does not initiate a refund.
- Administrators explicitly verify payments. Recording a receipt never confirms payment. Require the recorded amount to cover the total for confirmation; any underpayment policy needs clarification before launch.
- Administrator accounts are provisioned through a trusted setup step, never public registration or an editable customer profile field.
- Implementation can proceed locally without credentials. Live authentication, uploads, and database integration require the owner's Supabase project URL, public key, and database setup. Production requires a real payment QR and deployment access. Use environment configuration rather than sharing secret values in chat.

## Pages and navigation

| Route | Purpose |
| --- | --- |
| `/` | Welcome and product browsing; photos, descriptions, PHP prices, availability, add-to-cart |
| `/login`, `/register` | Authentication; guest add-to-cart returns to browsing after login |
| `/forgot-password`, `/reset-password` | Account recovery |
| `/account` | Contact and delivery information |
| `/cart` | Quantities, removal, item subtotals, total |
| `/checkout` | Delivery details, item review, explicit order confirmation |
| `/orders` | Customer order history |
| `/orders/[id]` | Order snapshot, status history, payment instructions, receipt submission and resubmission |
| `/admin` | Total orders and actionable status counts |
| `/admin/products` | Create, edit, archive, photos, availability |
| `/admin/orders` | Search and filters for number, customer, date, status |
| `/admin/orders/[id]` | Delivery/items, private receipt, payment review, notes, status history |
| `/admin/settings` | Permanent QR and payment instructions |

Customer navigation: Shop, Cart, My Orders, Account. Administrator navigation: Overview, Products, Orders, Payment Settings. On small screens use labeled, accessible navigation and stacked forms.

## Customer workflow

Browse without authentication. A guest adding a product goes to login/register and then back to the storefront. Signed-in customers manage their cart, review delivery information, and submit checkout once. The server checks every product and computes totals before creating an order and snapshots. Repeated submission with the same checkout key returns the same order.

The order detail shows its number, total, current permanent QR, and instructions. A receipt submission moves Pending Payment to Verifying Payment. Rejection shows the reason and allows another submission on that same order. Every attempt remains in history. Customers can view only their own records.

## Administrator workflow

Create products and upload photos; toggle availability or archive with confirmation. Open orders awaiting verification, view a private receipt, compare the amount against the total, and confirm with an amount received or reject with a mandatory reason. Move confirmed orders to Processing and then Completed. Edit internal notes separately. Replace the global payment QR without changing order snapshots.

## Design system

- Warm cream backgrounds, peach primary actions, lilac accents, green success states; dark readable text and sufficient contrast.
- Rounded cards, gentle shadows, generous spacing, clear headings, large labeled buttons.
- Responsive product grid and single-column mobile forms; compact admin order table with detail pages.
- Text and badges accompany status colors. Labels remain visible on form fields.
- Clear empty states, loading states, validation messages, retry guidance, and success feedback.
- Keyboard support, visible focus, accessible dialogs, and disabled unavailable actions.
- Use real product photographs when supplied. Demo content must be explicitly identified and never mistaken for live orders or successful payments.

## Milestones and acceptance checks

1. **Foundation and storefront:** Next.js/TypeScript/Tailwind setup, reusable controls, responsive navigation, product cards, environment template, and setup documentation. Check production build, type checking, responsive layout, and unavailable-product behavior.
2. **Database and accounts:** migrations, constraints, RLS, storage policies, authentication/recovery, profile editing, and protected routes. Check customer isolation, server-side admin denial, and auth redirects using two customers and an admin.
3. **Cart and checkout:** persisted cart, quantity controls, server pricing and availability validation, atomic order snapshots, idempotency, and order history. Test forged prices, stale availability, invalid quantities, retries, simultaneous duplicate checkout, and snapshot stability after price changes.
4. **Manual payment:** global QR configuration, private receipt upload/viewing, immutable submission history, review, mandatory rejection reasons, and resubmission. Test file access isolation, invalid files, repeated upload handling, and allowed status transitions.
5. **Administration:** product management, overview counts, order search/filter/detail, private notes, recorded amounts, fulfillment, and cancellation. Test authorization on every mutation and verify customer responses never expose notes.
6. **Release:** real configuration, real QR, complete customer/admin journey, accessibility/mobile checks, Vercel build, and deployment instructions. Deploy only with configured external resources; report outstanding integration checks honestly.

Each milestone updates its relevant documentation. Server/database rules should receive meaningful integration tests; avoid tests that merely repeat static presentation markup.

## Implementation status — October 13, 2026

Milestones 1–5 have source implementations, including the initial migration and trusted administrator provisioning script for `arrisnipshop@gmail.com`. The foundation, customer routes, and admin routes compile in production. Local PostgreSQL/security checks and desktop/mobile guest browser checks pass.

Milestone 6 deployment work is complete: source is pushed to `b4didot/arrishop`, Vercel project `arrie-store` is connected to `main`, and the website is live at `https://arrie.store` with www redirected to the apex. The Supabase schema and administrator memberships are deployed; the live catalog contains customer-supplied products. Production environment variables and Supabase callback URLs are configured. The hosted build, local database checks, and eight guest desktop/mobile browser checks pass. Full authenticated payment/recovery and simultaneous transaction verification remain separate checks. Local connection/session values remain in ignored files; migrations use the separate authenticated CLI session.
