# Café Operating System - API Modules Definition
## Phase 0: Core API Routes Planning

---

## 🏪 Cafe Management API

### Cafe Configuration
```
POST /api/cafe/create
  Purpose: Create new business account
  Auth: Public (registration)
  Body: { nameAr, nameEn, businessName, businessEmail, businessPhone, currency, timezone }
  Returns: { cafeId, accessToken }

GET /api/cafe/:cafeId
  Purpose: Get business configuration
  Auth: Required (any role)
  Returns: ICafe

PATCH /api/cafe/:cafeId
  Purpose: Update business settings
  Auth: Required (owner only)
  Body: Partial<ICafe>
  Returns: ICafe (updated)
```

---

## 🏢 Branch Management API

### Branch Operations
```
POST /api/branches
  Purpose: Create new branch
  Auth: Required (owner/manager)
  Body: { cafeId, nameAr, nameEn, address, phone, workingHours }
  Returns: IBranch

GET /api/branches/:branchId
  Purpose: Get branch details
  Auth: Required (tenant user)
  Returns: IBranch

PATCH /api/branches/:branchId
  Purpose: Update branch info
  Auth: Required (owner/manager)
  Body: Partial<IBranch>
  Returns: IBranch

GET /api/branches
  Purpose: List all branches for cafe
  Auth: Required (any role)
  Query: { cafeId }
  Returns: IBranch[]

DELETE /api/branches/:branchId
  Purpose: Soft delete branch
  Auth: Required (owner only)
  Returns: { success: true }
```

---

## 📋 Menu Management API

### Menu Items
```
POST /api/menu/items
  Purpose: Create menu item
  Auth: Required (manager+)
  Body: { cafeId, nameAr, nameEn, description, price, category, imageUrl }
  Returns: IMenuItem

GET /api/menu/items/:itemId
  Purpose: Get item details
  Auth: Required (any)
  Returns: IMenuItem

PATCH /api/menu/items/:itemId
  Purpose: Update item
  Auth: Required (manager+)
  Body: Partial<IMenuItem>
  Returns: IMenuItem

GET /api/menu/items
  Purpose: List menu items
  Auth: Required (any)
  Query: { cafeId, category, branchId }
  Returns: IMenuItem[]

DELETE /api/menu/items/:itemId
  Purpose: Soft delete item
  Auth: Required (manager+)
  Returns: { success: true }
```

### Modifiers/Addons
```
POST /api/menu/modifiers
  Purpose: Create addon (milk, syrup, etc.)
  Auth: Required (manager+)
  Body: { nameAr, nameEn, category, price, rawItemId }
  Returns: IModifier

GET /api/menu/modifiers
  Purpose: List modifiers
  Auth: Required (any)
  Query: { cafeId, category }
  Returns: IModifier[]

POST /api/menu/items/:itemId/modifiers
  Purpose: Link modifier to item
  Auth: Required (manager+)
  Body: { modifierId, isDefault, minQty, maxQty }
  Returns: { success: true }
```

---

## 🛒 Order Management API

### Order Creation & Management
```
POST /api/orders/create
  Purpose: Create new order
  Auth: Required (any) OR Public (for guest orders)
  Body: {
    cafeId, branchId, orderType, 
    items: [{ menuItemId, quantity, modifiers }],
    customerPhone?, customerName?,
    deliveryAddress? (for delivery)
  }
  Returns: IOrder

GET /api/orders/:orderId
  Purpose: Get order details
  Auth: Required (tenant user)
  Returns: IOrder

GET /api/orders
  Purpose: List orders (POS, kitchen, customer)
  Auth: Required (any)
  Query: { 
    cafeId, branchId?, status, 
    createdAfter?, createdBefore?,
    limit, offset 
  }
  Returns: IOrder[]

PATCH /api/orders/:orderId/status
  Purpose: Update order status
  Auth: Required (manager+, barista, cashier)
  Body: { status, reason? }
  Returns: IOrder

POST /api/orders/:orderId/cancel
  Purpose: Cancel order
  Auth: Required (owner, manager, cashier)
  Body: { reason, isRefund }
  Returns: IOrder

POST /api/orders/bulk-status
  Purpose: Update multiple orders (kitchen to kitchen-display)
  Auth: Required (manager+, barista)
  Body: { orderIds: string[], status }
  Returns: IOrder[]
```

### Payment & Checkout
```
POST /api/orders/:orderId/payment
  Purpose: Process payment
  Auth: Required (cashier)
  Body: { paymentMethod, amount, reference }
  Returns: { paymentId, status, receipt }

POST /api/orders/:orderId/refund
  Purpose: Refund order payment
  Auth: Required (manager+, cashier)
  Body: { amount?, reason }
  Returns: { refundId, status }
```

---

## 📦 Inventory Management API

### Raw Items (Ingredients)
```
POST /api/inventory/raw-items
  Purpose: Add new ingredient
  Auth: Required (manager+)
  Body: { cafeId, nameAr, nameEn, unit, costPerUnit, minThreshold, supplierId }
  Returns: IRawItem

GET /api/inventory/raw-items/:itemId
  Purpose: Get ingredient details
  Auth: Required (any)
  Returns: IRawItem

PATCH /api/inventory/raw-items/:itemId
  Purpose: Update ingredient
  Auth: Required (manager+)
  Body: Partial<IRawItem>
  Returns: IRawItem

GET /api/inventory/raw-items
  Purpose: List all ingredients
  Auth: Required (any)
  Query: { cafeId, category, lowStock }
  Returns: IRawItem[]
```

### Recipes
```
POST /api/inventory/recipes
  Purpose: Create recipe (cost template)
  Auth: Required (manager+)
  Body: {
    cafeId, nameAr, menuItemId,
    ingredients: [{ rawItemId, quantity, unit }]
  }
  Returns: IRecipe

GET /api/inventory/recipes/:recipeId
  Purpose: Get recipe with cost
  Auth: Required (any)
  Returns: IRecipe + { totalCost }

PATCH /api/inventory/recipes/:recipeId
  Purpose: Update recipe
  Auth: Required (manager+)
  Body: Partial<IRecipe>
  Returns: IRecipe
```

### Inventory Movements
```
POST /api/inventory/movements
  Purpose: Record stock movement
  Auth: Required (manager+, barista)
  Body: { rawItemId, type, quantity, reason, reference }
  Returns: IInventoryMovement

GET /api/inventory/movements
  Purpose: Get movement history
  Auth: Required (manager+)
  Query: { cafeId, rawItemId, type, createdAfter, createdBefore }
  Returns: IInventoryMovement[]

POST /api/inventory/adjust-stock
  Purpose: Physical count adjustment
  Auth: Required (manager+)
  Body: { rawItemId, newQuantity, reason }
  Returns: { previousQty, newQty, adjustment }
```

---

## 💰 Accounting & Reports API

### Daily/Period Snapshots
```
GET /api/accounting/daily
  Purpose: Get today's P&L
  Auth: Required (manager+)
  Query: { cafeId, branchId, date }
  Returns: IAccountingSnapshot

GET /api/accounting/reports
  Purpose: Get custom period report
  Auth: Required (manager+)
  Query: { cafeId, startDate, endDate, groupBy }
  Returns: IAccountingSnapshot + breakdown

GET /api/accounting/items
  Purpose: Top/bottom performing items
  Auth: Required (manager+)
  Query: { cafeId, period, limit }
  Returns: [{ itemId, qty, revenue, cogs, profit }]

GET /api/accounting/branches
  Purpose: Performance by branch
  Auth: Required (manager+)
  Query: { cafeId, period }
  Returns: [{ branchId, revenue, cogs, profit }]
```

---

## 👥 User & Auth API

### Authentication
```
POST /api/auth/login
  Purpose: User login
  Auth: Public
  Body: { email/phone, password }
  Returns: { userId, token, role, cafeId, branchId }

POST /api/auth/logout
  Purpose: Logout
  Auth: Required (any)
  Returns: { success: true }

POST /api/auth/refresh
  Purpose: Refresh token
  Auth: Required (any)
  Returns: { token }
```

### User Management
```
POST /api/users
  Purpose: Create user (employee)
  Auth: Required (owner/manager)
  Body: { cafeId, branchId, email, phone, role, nameAr }
  Returns: IUser

GET /api/users/:userId
  Purpose: Get user details
  Auth: Required (owner/manager or self)
  Returns: IUser

PATCH /api/users/:userId
  Purpose: Update user
  Auth: Required (owner/manager or self)
  Body: Partial<IUser>
  Returns: IUser

GET /api/users
  Purpose: List users
  Auth: Required (manager+)
  Query: { cafeId, branchId, role }
  Returns: IUser[]

DELETE /api/users/:userId
  Purpose: Deactivate user
  Auth: Required (owner/manager)
  Returns: { success: true }
```

---

## 🔄 Real-time Updates (WebSocket)

```
EVENTS:
ws://server/ws?token={jwt}

1. order:created → Send to kitchen, cashier, customer
2. order:status-updated → Send to interested parties
3. order:cancelled → Send to kitchen, cashier
4. inventory:low-stock → Send to manager
5. payment:completed → Send to cashier, manager
6. delivery:location-updated → Send to customer, manager
```

---

## 📊 Summary of Modules

| Module | Routes | Purpose |
|--------|--------|---------|
| Cafe | 3 | Business configuration |
| Branch | 5 | Multi-branch management |
| Menu | 7 | Products & modifiers |
| Order | 8 | Order lifecycle |
| Inventory | 8 | Stock tracking |
| Accounting | 4 | Financial reporting |
| Auth | 5 | Authentication |
| WebSocket | Events | Real-time updates |
| **TOTAL** | **40+** | **Full system** |

---

## 🔐 Authentication & Authorization

### Token-based JWT
- **Issued on login**: Valid for 24 hours
- **Tenant scope**: cafeId embedded in token
- **Role-based**: Authorization checked per route

### Middleware Chain
```
Request → JWT Verify → Tenant Check → Role Check → Route Handler
```

---

## 📈 Phase 0 API Status

| Status | Module | Details |
|--------|--------|---------|
| 🟢 Defined | Cafe Management | Interface defined |
| 🟢 Defined | Branch Management | Interface defined |
| 🟢 Defined | Menu Management | Interface defined |
| 🟢 Defined | Order Management | Interface defined |
| 🟢 Defined | Inventory Management | Interface defined |
| 🟢 Defined | Accounting | Interface defined |
| 🟢 Defined | Auth | Interface defined |
| 🟡 TODO | Implementation | Routes need implementation (Phase 1) |
| 🟡 TODO | Validation | Zod schemas needed (Phase 1) |
| 🟡 TODO | Testing | Unit & E2E tests (Phase 2) |

---

**Version**: 1.0
**Phase**: 0 (Definition)
**Status**: 100% Defined
**Next Step**: Phase 1 - Implementation
