## Overview

CLUNY CAFE is a comprehensive digital management system designed to streamline operations for coffee shops, catering to both customers through the CLUNY CAFE portal and employees via the CLUNY SYSTEMS portal. The system aims to modernize coffee shop management, enhance customer experience, and improve operational efficiency. Key capabilities include integrated ERP accounting, ZATCA-compliant invoicing, robust delivery management, employee shift and geofencing, a customer loyalty program, and a 3-layer unified push notification system with full security hardening.

## Security Architecture (Added)

Full security hardening is implemented via:
1. **Helmet.js**: Sets 14 HTTP security headers including CSP, HSTS, X-Frame-Options, X-Content-Type-Options
2. **Rate Limiting**: Login endpoints limited to 10 req/15min, general API to 300 req/min (dev mode bypasses)
3. **NoSQL Injection Protection**: `express-mongo-sanitize` strips `$` and `.` from all request fields
4. **HTTP Parameter Pollution (HPP)**: `hpp` prevents array parameter pollution attacks
5. **Session Security**: httpOnly cookies, secure in production, SameSite protection, MongoDB-backed session store

## Notification System Architecture (Added)

A unified 3-layer notification system via `server/notification-engine.ts`:

**`fireNotify(userId, title, body, opts)`** - Single user notification:
- Layer 1: Saves to MongoDB `NotificationModel` (persists when device is off)
- Layer 2: WebSocket push to user (instant in-app popup if device is online)
- Layer 3: Web Push (device/system notification if app is closed via VAPID)

**`fireNotifyAdmins(title, body, opts)`** - Notifies all managers/admins/owners

**`fireNotifyBroadcast(title, body, opts)`** - All subscribers of a tenant

Notifications are triggered on:
- Order creation → customer notified, admins notified
- Order status change (in_progress, ready, completed, cancelled, etc.) → customer notified
- Manual broadcast from admin panel at `/admin/notifications`

The `NotificationBell` component shows real-time unread count badge with WS connection, toast popups, and native browser notifications. Added to employee dashboard mobile header.

## User Preferences

- All texts are in Arabic with English support for data.
- The system fully supports RTL.
- Iterative development approach.
- Work in Fast mode with small, focused chunks.

## System Architecture

### Design System (CLUNY)

The system employs a modern, clean design inspired by Noon Food, featuring a vibrant teal green primary color (`#2D9B6E`) and ocean blue accent (`#2196F3`) against a pure white background. Typography uses Playfair Display for headings and Inter for body text, with Cairo as a fallback for Arabic. Core design elements include a muted sage and rich coffee brown color palette, and distinct role-based layouts (Customer, POS, Kitchen, Manager) with unified components for loading, empty, and error states.

### Technical Implementations

The system features real-time POS order alerts and management via WebSockets, supporting configurable business modes (cafe, restaurant, both), and an ERP Accounting System with a professional Chart of Accounts following Saudi standards, double-entry bookkeeping, and financial reports. It includes ZATCA-compliant invoicing with TLV encoded QR codes, a Kitchen Display System (KDS) with SLA tracking and allergen warnings, and a points-based Loyalty Program.

**Loyalty Program Rules (Updated):**
- 10 points per item priced >1 SAR
- 50 points = 1 SAR (pointsValueInSar = 0.02)
- Minimum 100 points to redeem
- No points earned when paying with points (pointsUsed: true)
- POS employee can apply points discount; "بطاقة كلوني" shown on invoice
- Stamps system removed; replaced by points-only model
- Loyalty card redesigned as silver-blue credit card style

Other key features include a referral system, an interactive Menu Page redesign with group filtering and PWA support, promotional offers (bundles/combos), an enhanced addons system for both general and specific items, and a Table Reservation System with time-based occupancy. The Checkout Page supports discount codes and split payments. A comprehensive Delivery System manages external platform integrations, geospatial delivery zones, and driver tracking. Employee management includes branch geofencing, flexible shift management, and granular Role-Based Access Control (RBAC) with page-level permissions. PWA configurations dynamically switch manifests between customer and employee portals.

- **POS Customer Display**: A dedicated fullscreen customer-facing screen at `/customer-display` that syncs with the POS in real-time via WebSocket (`pos-display` client type). Two modes: Idle (shows logo, time, product image strip with auto-scroll) and Order Review (shows cart items, quantities, subtotal, VAT, total). Special states: payment_processing (spinner) and payment_success (auto-returns to idle after 5s). The POS has a "شاشة العميل" button to open it in a new window. All pointer events and keyboard shortcuts disabled.

- **Inline Item Addons System**: Products can have built-in addons (e.g., "extra shot", "oat milk") stored in `CoffeeItem.addons[]` with nameAr, nameEn, price fields. These are selectable in the add-to-cart modal, POS addon dialog, and stored in cart/order as `selectedItemAddons`. Prices are factored into all totals (cart store, POS calculate, checkout). Addons appear in kitchen orders, receipts, invoices, and cashier view extras.
- **Multiple Images Per Product**: `CoffeeItem.imageUrls[]` stores up to 5 images per drink. First image is primary (backward compat via `imageUrl = imageUrls[0]`). Add/Edit dialogs in menu management show thumbnail grid with primary badge and remove buttons.

The system also includes:
- **Admin-Configurable Loyalty & Offers System**: Admin can control points-per-SAR ratio, min points for redemption, and loyalty program toggle. Dynamic offers for first order, comeback, frequent customer, special drink, and points redemption are configurable.
- **Discount Codes Management**: Full CRUD for discount codes with type/value/max uses.
- **Dynamic Cluny Card**: Points-per-SAR ratio in customer card page driven by admin config.
- **Rich Push Notification System**: Professional lock-screen notifications for Android/iOS with real-time updates for orders, customer details, and status. Supports contextual actions and RTL.
- **PWA Background Push Notifications**: Service Worker handles push events, background sync for offline orders, and notifications even when the app is closed.
- **Auto Push Subscription**: `useNotifications` hook manages VAPID key exchange and server registration for employees and customers.
- **Scheduled Branch Pickup**: Customers can select "scheduled pickup from branch" with an arrival time. The system calculates when to start preparation (base 10 min before arrival + 2 min per extra item). Orders appear as "on hold" in the Kitchen Display System (KDS) until prep time, then alert the kitchen with a sound and visual indicator. Fields: `scheduledPickupTime` and `preparationHoldUntil` stored on orders. KDS has a dedicated "مجدول" tab for all scheduled orders.
- **Employee-Specific PWA**: Dedicated `employee-manifest.json` for tailored staff portal experience.
- **Payment Gateway Management System**: Admin can select NeoLeap, Geidea, or Paymob, enter encrypted credentials, and toggle payment methods. Paymob integration uses the 3-step Accept API (auth token → order → payment key → iframe redirect) with HMAC webhook verification.
- **Secure Online Payment Flow**: PCI compliant checkout using hosted redirects and server-side verification.
- **Config-Driven Payment Methods**: `/api/payment-methods` endpoint returns enabled methods dynamically based on admin configuration.
- **Loyalty Points Redemption Security**: Email verification codes required for points redemption.
- **Complete i18n Translation System**: All customer menu text uses i18n keys for Arabic and English, with dynamic switching for categories, banners, and UI labels.
- **Independent Food/Drinks Management**: Employee menu management filters items by type (drinks/food) with separate sidebar links and category selectors.
- **Menu Categories Employee-Managed**: Category add/delete moved to admin settings; categories have a `department` field for drinks/food management.
- **Account Creation Enhancement**: Parent account selector for nested account hierarchy.
- **Enhanced Customer Profile Page**: Profile editing for name and email; phone number display.
- **Fixed Inventory Deduction Bug**: Proper inventory deduction and accounting for `costOfGoods`.
- **Accounting Journal Entries for Purchases**: Automatic double-entry journal entries for inventory receipts.
- **Dynamic Menu Categories**: Custom menu categories/sections with CRUD and tenant scoping.
- **Drink Grouping by First Arabic Word**: Menu groups drinks by the first Arabic word.
- **Drink Addon System**: Drinks can be linked as addons with display in add-to-cart modal.
- **Cart Display Enhancement**: Cart badges show linked drink names and icons.

## New Features (March 2026 - Session 2)

- **Real Analytics Dashboard**: `GET /api/analytics/advanced` with real MongoDB aggregations (top products, peak hours, employee performance, payment methods, 7-day revenue trend). `advanced-analytics.tsx` rewritten with 4 real-data tabs.
- **Payroll Management**: `/manager/payroll` page with salary reports, deductions, and per-employee breakdown. Backend: `GET /api/payroll`.
- **Customer Favorites**: Heart icon toggle in menu layouts (Classic/Cards/List views). Persisted per customer via `POST /api/menu/favorites/toggle`.
- **Customer Reviews System**: Star rating form in `my-orders.tsx` for completed orders. Manager review dashboard at `/manager/reviews` with manager reply feature. Backend: `POST /api/reviews/order/:orderId`, `PATCH /api/reviews/:id/reply`.
- **Digital Gift Cards**: Full CRUD management at `/manager/gift-cards`. `GiftCardModel` in schema. API routes for create/update/deactivate/validate.
- **Seasonal Menu Filtering**: Time-based item visibility in `menu.tsx` using `availableFrom`, `availableTo`, `availableDays` fields on `CoffeeItem`. Items outside their scheduled window are automatically hidden from the customer menu.
- **WhatsApp Reservation Notification**: When cashier creates a table reservation, the backend response's `whatsappNotification.url` is automatically opened in a new browser tab to notify the customer via WhatsApp.
- **COGS / Profit Margin Report**: `GET /api/analytics/cogs` returns profit margins for all menu items. New "تقرير التكاليف" tab in the Supplier Management page (`/manager/suppliers`) with summary cards and sortable item table.
- **Automatic Inventory Alerts**: Both stock adjustment routes (`/api/inventory/stock/adjust` and `/api/inventory/stock-adjustment`) now auto-create a `StockAlert` when quantity falls at or below `minStockLevel`, preventing duplicate alerts via an unresolved alert check.

## Recent Fixes & Code Health (March 2026)

### Comprehensive Bug Fixes
- **Duplicate loyalty points**: Added `pointsAwarded` field to `OrderSchema` + `IOrder` interface; `deductInventoryForOrder` now checks flag before awarding and marks `pointsAwarded: true` after
- **WhatsApp message prices**: Fixed `generateWhatsAppLink` in `employee-cashier.tsx` to include size price and addon prices in per-item cost
- **AppointmentModel import**: Added missing `AppointmentModel` to `storage.ts` imports from `@shared/schema`
- **updateBranchMaintenance**: Implemented missing method in `DBStorage` class
- **NeoLeap sessionId**: Fixed `sessionId` undefined error → replaced with `internalSessionId`
- **Loyalty card PIN**: Fixed `customer.cardPassword` (non-existent) → `bcrypt.compare(pin, customer.password)`
- **availabilityStatus types**: Fixed string interpolations to valid enum values `"out_of_stock"` / `"available"`
- **showCouponSuggestions**: Added missing `useState` in `checkout.tsx`
- **dineIn in IOrder**: Added missing `dineIn?: boolean` to `IOrder` interface
- **Driver void methods**: Fixed routes using void return values of `updateDriverAvailability/Location`, `assignDriverToOrder`, `startDelivery`; used `getOrder` for complete-delivery
- **TaxInvoiceModel import**: Added to `routes.ts` imports
- **wsManager.broadcast**: Fixed to `broadcastToBranch` (correct method name)
- **createLoyaltyCard/Transaction extra fields**: Added `as any` casts for `customerId`, `points` extra fields
- **PushPayload interface**: Added `orderId` and `status` optional fields
- **createTaxInvoice 2 args**: Moved `invoiceNumber` into data object; removed second argument
- **updateTableOccupancy null**: Changed `null` to `undefined` for optional orderId
- **getTableOrders string|undefined**: Added `as string || ''` fallback
- **branch._id unknown**: Added `as any` cast for Mongoose lean result
- **sendOrderNotificationEmail totalAmount**: Added `|| 0` null safety
- **updateTable string|undefined**: Added `as string` cast

### Layout & UI Features
- Menu and Cashier layout switching (Classic/Cards/List for menu; Classic/POS/Split for cashier)
- Admin visual layout picker in settings
- Qirox Studio footer on customer menu page

### Auth Architecture
- `requireAuth` middleware auto-restores sessions from `X-Employee-Id` and `X-Restore-Key` HTTP headers
- Every API request includes these headers via `apiRequest` / `getQueryFn` in `queryClient.ts`

### Duplicate Route Cleanup (server/routes.ts)
Removed 11 dead-code duplicate route handlers. All known duplicates resolved (March 2026):
- `GET /api/tables` dead duplicate at ~7300 removed
- `PATCH /api/orders/:id/status` dead duplicate at ~8600 removed
- `GET /api/inventory/movements` dead duplicate at ~11000 removed

### ZATCA Auto-Invoice Fix
`PATCH /api/orders/:id/status` (used by POS) now auto-generates ZATCA invoices on `completed`/`ready` status, same as the `PUT` endpoint used by KDS.

### POS Screen Zoom
Added zoom control (60%-100%) in POS settings dialog. Applies CSS `transform: scale()` to entire UI. Saved to localStorage.

### Image Upload Fix
Added `wrapMulter` helper for all upload routes. Multer errors now return JSON instead of HTML. File size limit raised to 15MB. Accept any `image/*` MIME type.

### Admin Navigation (AdminLayout Integration)

All admin routes now wrapped with `AdminLayout` in `App.tsx`:
- `/admin/dashboard`, `/admin/employees`, `/admin/reports`, `/admin/settings`, `/admin/branches`, `/admin/email`, `/admin/notifications` — all protected by AuthGuard + displayed inside AdminLayout sidebar wrapper.
- Admin notifications page (`/admin/notifications`) was previously unprotected; now has `AuthGuard userType="manager"` and AdminLayout sidebar.
- `admin-sidebar.tsx` includes 5 nav items: Dashboard, Employees, Reports, الإشعارات (Bell), Settings.

### POS System Fixes

- `getGroupingKey` uses `${category}::${nameBase}` to prevent cross-category product collisions.
- Products with a single variant AND no `availableSizes` are added directly to cart without opening the customization dialog.
- `DrinkCustomizationDialog` accepts optional `modal` prop (default `true`); POS passes `modal={false}` so product cards behind the open dialog remain clickable.

### Technical Stack

- **Backend:** Node.js, Express.js, MongoDB with Mongoose, Zod.
- **Frontend:** React, TypeScript, Vite, TanStack Query, shadcn/ui, Tailwind CSS, Wouter.
- **Security:** AuthGuard (role-based), PageGuard (page-level permissions), local storage for session management.

## External Dependencies

- **Database:** MongoDB Atlas (CLUNY-CAFE Project) — connection string in `MONGODB_URI` env var
- **Mapping/Geospatial:** `turf.js`
- **Charting:** `recharts`
- **Delivery Platforms (Integrations):** Noon Food, Hunger Station, Keeta, Marsool, Careem.
- **QR Code Generation:** `zatca-utils.ts` (custom utility module).

## Replit Migration Notes

- **WebSocket Fix**: The app's WebSocket server (`/ws/orders`) was changed to use `noServer: true` + manual upgrade handling in `server/websocket.ts` so it no longer blocks Vite's HMR WebSocket connections.
- **HMR Config**: Vite HMR config in `server/vite.ts` uses `hmr: { server }` (piggybacking on the Express HTTP server).
- **i18n Stability**: Added `!i18n.isInitialized` guard in `client/src/lib/i18n.ts` to prevent double-initialization during HMR. Also explicitly imported i18n in `client/src/main.tsx`.
- **CSP Update**: Helmet CSP `connectSrc` expanded to include `https:`, `https://*.replit.dev`, and `https://*.kirk.replit.dev` for Replit dev domain connectivity.
- **Service Worker**: Cache version bumped to `cluny-cafe-v2` to clear stale cached assets after migration.
- **Run command**: `npm run dev` (starts tsx server on port 5000, serves both API and Vite-compiled frontend).
- **Build command**: `npm run build` (Vite build + esbuild server bundle to `dist/`).
- **Deploy command**: `node dist/index.js` (production server).
- **Apple Pay / Geidea Update (April 2026)**: Installed the latest Geidea-provided Apple Pay domain association file at `public/.well-known/apple-developer-merchantid-domain-association` and mirrored it to `client/public/.well-known/`. Stored the latest Apple Pay payment processing certificate at `certs/apple_pay_payment_processing_merchant_cluny_cafe.cer`. Apple Pay now defaults to domain `cluny.cafe` and merchant ID `merchant.cluny.cafe`, with diagnostics available at `/api/payments/apple-pay/diagnose`.

## Recent Enhancements (April 2026)

### Sales Analytics API
- Added `GET /api/orders/analytics?from=&to=` endpoint in `server/routes.ts` before `/api/orders`
- Returns: `totalRevenue`, `totalOrders`, `avgOrderValue`, `topProducts`, `revenueByDay`, `paymentBreakdown`, `channelBreakdown`
- Uses `.select().lean()` for performance — does NOT return full order objects
- Replaces the old `/api/orders` fetch in admin-dashboard which loaded 200+ full orders

### Admin Dashboard Rewrite (admin-dashboard.tsx)
- Date range filter: Today / Yesterday / 7 Days / 30 Days / 90 Days
- KPI cards: Revenue, Orders, Avg Order, Top Product
- Bar chart (recharts) for revenue by day
- Horizontal bar chart for payment method breakdown (cash, card, split, etc.)
- Product rank bars showing quantity + revenue per product
- Auto-refreshes with a manual refresh button

### Print System — Iframe-based (no popup)
- `openPrintWindow` in `print-utils.ts` now uses a hidden `<iframe>` instead of `window.open()`
- Auto-print script inside the iframe calls `window.print()` from within iframe context
- Eliminates the "popup freeze" bug when clicking outside the print popup
- Works with popup blockers — no browser permission needed
- Iframe removed after `afterprint` event or 30s fallback timeout

### Split Payment in All Invoices
- `TaxInvoiceData` interface now has `splitCash?: number` and `splitCard?: number` fields
- All print functions (`printTaxInvoice`, `printUnifiedReceipt`, `printCustomerPickupReceipt`, `printCashierReceipt`, `printSimpleReceipt`) now display split breakdown when `paymentMethod === 'split'`
- POS `handleCheckout` and `handlePrintReceipt` pass split amounts to all print calls

### Direct USB Thermal Printer (Web Serial API)
- New `client/src/lib/thermal-printer.ts` library with full ESC/POS command set
- Supports: Epson, Bixolon, Xprinter and most 80mm USB thermal printers
- `connectPrinter()` — opens Web Serial port browser dialog
- `testPrint()` — sends a test page
- `printReceiptToThermal(data)` — sends full ESC/POS receipt with Arabic encoding
- Split payment printed directly to thermal paper
- Printer icon button in POS header (Chrome/Edge only, Web Serial support check)
- Connection dialog with status indicator (connected/disconnected dot)
- When thermal printer is connected: auto-print uses ESC/POS (no browser dialog)
- When thermal printer is not connected: fallback to iframe-based browser print
- **Admin Mobile UX & Detailed Sales Analytics (April 2026)**: Admin portal now uses the Shadcn sidebar primitives with RTL mobile drawer, sticky mobile header, bottom quick navigation, and responsive full-width content. `/admin/reports` now provides detailed day-by-day sales analytics, product-level sold item breakdowns, hourly daily timeline, payment/status/employee breakdowns, mobile order cards, and flexible filtering by date range, selected day, status, payment method, and search. Added `/admin/apple-pay-health` as an admin-facing Apple Pay/Geidea diagnostic dashboard.
- **Geidea Checkout Visibility Fix (April 2026)**: The checkout page now renders the Geidea widget visibly inside the payment overlay instead of inside a hidden wrapper, so loading/error/retry states appear to customers instead of a blank payment screen. Helmet CSP was also expanded for Geidea KSA script/connect/style/font hosts.