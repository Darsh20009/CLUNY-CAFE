# Cluny Cafe — نظام إدارة المقاهي

A full-stack café management system for CLUNY CAFE, built with React + Express + MongoDB.

## Stack

- **Frontend**: React 18, Vite, TailwindCSS, shadcn/ui, TanStack Query, Wouter
- **Backend**: Express.js, TypeScript (tsx), WebSockets
- **Database**: MongoDB via Mongoose
- **Auth**: Passport.js (local strategy) + express-session + MongoStore
- **Real-time**: WebSocket server at `/ws/orders`

## How to run

```
npm run dev
```

Starts the Express server (port 5000) with Vite middleware for hot-reloading the React frontend.

## Required environment variables

| Variable | Description | Status |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string (Atlas or local) | ✅ Set (Atlas) |
| `SESSION_SECRET` | Secret for express-session cookie signing | ✅ Set |
| `MONGODB_URI_2` | (Optional) Secondary DB for auto-rotation | Not set |

`npm install` was run to populate `node_modules` (missing after import). The `Start application` workflow (`npm run dev`) runs the Express server with Vite middleware on port 5000.

## Bandwidth protection

- `npm run build` generates resized WebP variants for raster images in `attached_assets`, `public`, and `client/public`.
- The server serves the WebP variant transparently when the browser supports it, while keeping the original image URLs compatible.
- Product thumbnails use lazy loading and asynchronous decoding to avoid downloading off-screen images.

## Project structure

```
client/        React frontend (pages, components, hooks)
server/        Express backend (routes, engines, middleware)
shared/        Shared TypeScript types and Mongoose schemas
attached_assets/ Static assets (images, logos)
data/          Seed/fixture data
```

## Key features

- **POS system** — order taking, payment, receipts
- **Kitchen Display** — real-time order queue
- **Admin dashboard** — staff, menu, inventory, accounting
- **Customer app** — loyalty points, QR ordering
- **Multi-tenant** — isolated by `cafeId`/`tenantId`
- **ZATCA compliance** — Saudi e-invoicing support

## User preferences

- Keep existing project structure and stack
- Do not restructure or migrate the database setup
