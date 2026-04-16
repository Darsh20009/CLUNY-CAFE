# Café Operating System - Architecture Guide

## 📐 System Architecture Overview

### Layer Structure

```
┌─────────────────────────────────────────────┐
│         Frontend Layer (React/Vite)         │
│  - Pages (POS, Kitchen, Admin, Customer)    │
│  - Components (UI, Forms, Dialogs)          │
│  - Hooks (State management, Queries)        │
│  - Lib (Utilities, API client)              │
└────────────────────┬────────────────────────┘
                     │ HTTP/WebSocket
┌────────────────────▼────────────────────────┐
│     API Layer (Express Routes)              │
│  - /api/cafe/* (Business config)            │
│  - /api/branch/* (Branch operations)        │
│  - /api/menu/* (Menu management)            │
│  - /api/orders/* (Order processing)         │
│  - /api/inventory/* (Stock management)      │
│  - /api/accounting/* (Financial reports)    │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│     Business Logic Layer                    │
│  - Order Engine (Processing, Status)        │
│  - Recipe Engine (Cost calculation)         │
│  - Inventory Engine (Stock tracking)        │
│  - Pricing Engine (Discount, Tax)           │
│  - Accounting Engine (P&L, Reports)         │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│       Data Access Layer (MongoDB)           │
│  - Collections (Cafe, Branch, Order, etc.)  │
│  - Indexes (Performance optimization)       │
│  - Transactions (Data consistency)          │
└─────────────────────────────────────────────┘
```

### Frontend Directory Structure
```
client/src/
├── pages/
│   ├── pos-system.tsx           (POS Interface)
│   ├── kitchen-display.tsx      (Kitchen Display System)
│   ├── admin-dashboard.tsx      (Admin Panel)
│   ├── admin-employees.tsx      (Staff Management)
│   ├── admin-settings.tsx       (Business Config)
│   ├── manager-dashboard.tsx    (Manager Reports)
│   ├── accounting-*.tsx         (Financial Reporting)
│   ├── inventory-*.tsx          (Stock Management)
│   └── customer-*.tsx           (Customer App)
├── components/
│   ├── layouts/                 (Page layouts)
│   ├── guards/                  (Auth guards)
│   └── ui/                      (Shadcn components)
├── hooks/
│   ├── use-session.ts           (Auth state)
│   └── use-mobile.tsx           (Responsive)
├── lib/
│   ├── queryClient.ts           (TanStack Query)
│   └── utils.ts                 (Helpers)
└── contexts/
    └── CustomerContext.tsx      (Customer state)
```

### Backend Directory Structure
```
server/
├── index.ts                     (Entry point)
├── routes.ts                    (All API routes)
├── storage.ts                   (Data access interface)
├── vite.ts                      (Vite integration)
├── websocket.ts                 (Real-time updates)
├── mail-service.ts              (Email sending)
├── middleware/
│   ├── auth.ts                  (JWT auth)
│   └── tenant.ts                (Multi-tenancy)
├── utils/
│   ├── zatca.ts                 (ZATCA compliance)
│   └── geo.ts                   (Location utilities)
└── migrations/
    └── migrate-*.ts             (Database migrations)
```

### Data Models Organization
```
shared/schema.ts (All TypeScript Interfaces & Mongoose Schemas)
│
├── ICafe + CafeSchema
├── IBranch + BranchSchema
├── IUser + UserSchema (TODO: Need to add)
├── IMenuItem + MenuItemSchema
├── IModifier + ModifierSchema
├── IOrder + OrderSchema
├── IRawItem + RawItemSchema (TODO: Rename from Ingredient)
├── IRecipe + RecipeSchema
├── IInventoryMovement + InventoryMovementSchema
└── IAccountingSnapshot + AccountingSnapshotSchema (TODO: Add)
```

---

## 🔄 Data Flow

### Order Processing Flow
```
Customer Places Order
  ↓
[Order Created] → status: pending
  ↓
[Order Confirmed] → status: confirmed, payment processed
  ↓
[Recipe Engine] → Calculate COGS, Determine ingredients
  ↓
[Inventory Deducted] → InventoryMovement records created
  ↓
[Barista/Kitchen] → status: preparing
  ↓
[Order Ready] → status: ready (notification sent)
  ↓
[Delivery/Pickup] → status: delivered/collected
  ↓
[Accounting] → Snapshot updated, P&L calculated
```

### Inventory Flow
```
Purchase Order → [RawItem stock increased]
  ↓
Order Created → [Inventory deducted via Recipe]
  ↓
Waste Recorded → [Inventory adjusted]
  ↓
Daily Accounting → [COGS calculated, Waste analyzed]
```

---

## 🔐 Security & Multi-Tenancy

### Tenant Isolation
- Every entity linked to `cafeId`
- Middleware validates tenant access
- Routes check branch ownership

### User Roles & Permissions
```
Owner (Full access to all branches & features)
  ├── Manager (Dashboard, analytics, staff management)
  │   ├── Cashier (POS, payments, refunds)
  │   └── Barista (Kitchen orders, inventory)
  └── Kitchen Staff (Receive & prepare orders)
  
Driver (Delivery only)
Customer (Mobile app, loyalty, orders)
```

---

## 📡 API Module Structure

### Cafe Management
- `POST /api/cafe/create` - Create business
- `GET /api/cafe/:id` - Get config
- `PATCH /api/cafe/:id` - Update settings

### Orders
- `POST /api/orders/create` - Create order
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id/status` - Update status
- `GET /api/orders` - List orders (with filters)

### Inventory
- `POST /api/inventory/raw-items` - Add ingredient
- `PATCH /api/inventory/raw-items/:id` - Update stock
- `GET /api/inventory/movements` - Track movements
- `POST /api/inventory/recipes` - Create recipe

### Accounting
- `GET /api/accounting/daily` - Daily P&L
- `GET /api/accounting/reports` - Custom reports

---

## ⚙️ Quality Assurance Framework

### Code Organization Rules
1. **No Magic Numbers**: All constants in config/constants file
2. **Unified Error Handling**: All errors follow `ApiError` format
3. **Validated Inputs**: All route params validated with Zod
4. **Type Safety**: Full TypeScript strict mode
5. **Logging**: All significant operations logged with context

### Testing Strategy (Phase 2+)
- Unit tests for business logic engines
- Integration tests for order flow
- E2E tests for critical user paths

---

## 🚀 Deployment Architecture

### Production Setup
- **Frontend**: Built React SPA
- **Backend**: Node.js Express server
- **Database**: MongoDB Atlas (production) / Local (dev)
- **Real-time**: WebSocket for order updates
- **File Storage**: Local/S3 for receipts & images

---

**Last Updated**: December 27, 2025
**Phase**: 0 (Architecture Definition)
**Status**: 75% Complete
