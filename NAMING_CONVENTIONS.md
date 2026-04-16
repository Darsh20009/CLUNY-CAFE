# Café Operating System - Naming Conventions & Standards
## Phase 0: Code Organization Rules

---

## 📝 TypeScript Naming Conventions

### Interfaces (Domain Models)
**Pattern**: `I{EntityName}`
```typescript
ICafe              // Business entity
IBranch            // Branch
IUser              // User/Employee
IMenuItem          // Menu item
IModifier          // Addon/Modifier
IOrder             // Order
IRawItem           // Ingredient/Raw material
IRecipe            // Recipe
IInventoryMovement // Inventory tracking
IAccountingSnapshot// Financial snapshots
ICustomer          // Customer profile
ILoyaltyCard       // Loyalty program
```

### Mongoose Models & Schemas
**Pattern**: `{EntityName}Model` and `{EntityName}Schema`
```typescript
CafeModel, CafeSchema
BranchModel, BranchSchema
OrderModel, OrderSchema
RawItemModel, RawItemSchema
```

### React Components
**Pattern**: `{ComponentName}.tsx` (PascalCase)
```typescript
OrderCard.tsx          // Component file
OrderCard.stories.tsx  // Storybook file
useOrderForm.ts        // Custom hook file
```

### Files & Directories
**Pattern**: kebab-case for files, camelCase for exports
```typescript
// File: order-service.ts
export const createOrder = () => {}
export const updateOrderStatus = () => {}

// File: inventory-engine.ts
export const calculateCOGS = () => {}
export const deductInventory = () => {}
```

### Constants
**Pattern**: UPPER_SNAKE_CASE
```typescript
const ORDER_STATUS_PENDING = "pending";
const VAT_PERCENTAGE_SA = 15;
const MAX_DELIVERY_DISTANCE_KM = 50;
const PIZZA_PREPARATION_TIME_MIN = 20;
```

### Enums
**Pattern**: PascalCase for enum name, UPPER_SNAKE_CASE for values
```typescript
enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PREPARING = "preparing",
  READY = "ready",
  DELIVERED = "delivered",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

enum UserRole {
  OWNER = "owner",
  MANAGER = "manager",
  CASHIER = "cashier",
  BARISTA = "barista",
  DELIVERY_DRIVER = "delivery_driver",
}
```

---

## 🔗 Database Naming Conventions

### Collection Names (MongoDB)
**Pattern**: camelCase, singular
```typescript
cafe           // Business configurations
branch         // Branch locations
user           // Users/Employees
menuItem       // Menu items
modifier       // Modifiers/Addons
order          // Orders
orderItem      // Line items in orders
rawItem        // Raw ingredients/materials
recipe         // Recipes (cost templates)
inventoryMovement  // Stock movements
accountingSnapshot // Financial snapshots
loyaltyCard    // Loyalty cards
customer       // Customers
```

### Document ID Fields
**Pattern**: `id` (not `_id`)
```typescript
id: string // UUID for cross-document references
_id: ObjectId // Default MongoDB ID
```

### Field Naming
**Pattern**: camelCase
```typescript
interface IOrder {
  id: string
  cafeId: string              // Foreign key reference
  branchId: string            // Foreign key reference
  orderNumber: string
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  customerName: string
  totalAmount: number
  vatAmount: number
  costOfGoods: number
  createdAt: Date
  updatedAt: Date
}
```

### Index Naming
**Pattern**: Describe the fields
```typescript
// Index on single field
menuItem.index({ cafeId: 1 })

// Compound index
order.index({ cafeId: 1, status: 1 })

// Unique index
user.index({ email: 1 }, { unique: true })

// TTL index
passwordReset.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

---

## 🛣️ API Route Naming Conventions

### Route Structure
**Pattern**: `/api/{resource}/{action}` or `/api/{resource}:{operation}`

### GET Routes (Reading)
```
GET /api/orders              // List all orders
GET /api/orders/:id          // Get single order
GET /api/orders?status=ready // List with filters
GET /api/orders/:id/items    // Get related resources
```

### POST Routes (Creating)
```
POST /api/orders             // Create order
POST /api/orders/:id/items   // Add items to order
POST /api/orders/:id/cancel  // Custom action
```

### PATCH/PUT Routes (Updating)
```
PATCH /api/orders/:id        // Update entire order
PATCH /api/orders/:id/status // Update specific field
```

### DELETE Routes (Deleting)
```
DELETE /api/orders/:id       // Delete order
```

### RPC-style Routes (Complex Actions)
```
POST /api/orders/bulk-create
POST /api/accounting/calculate-daily
POST /api/inventory/adjust-stock
```

---

## 🔑 Foreign Key Naming

**Pattern**: `{EntityName}Id` (singular)
```typescript
cafeId         // Reference to Cafe
branchId       // Reference to Branch
userId         // Reference to User
menuItemId     // Reference to MenuItem
orderId        // Reference to Order
rawItemId      // Reference to RawItem
recipeId       // Reference to Recipe
customerId     // Reference to Customer
supplierId     // Reference to Supplier
```

---

## ⏱️ Timestamp Field Naming

**Pattern**: Consistent naming across all entities
```typescript
createdAt      // When document was created
updatedAt      // Last update timestamp
deletedAt      // Soft delete timestamp (if used)
lastModifiedBy // User who made last change
lastLoginAt    // Last login for users
completedAt    // When order was completed
deliveredAt    // When order was delivered
expiresAt      // Expiration timestamp (for tokens, OTPs)
```

---

## 💰 Financial Field Naming

**Pattern**: Clear indication of type and currency
```typescript
price              // Item price in units (SAR, etc.)
cost              // Cost price for COGS calculation
totalAmount       // Final amount for invoice
subtotal          // Before tax
taxAmount         // VAT/Tax amount
discountAmount    // Discount value (not percentage)
deliveryFee       // Delivery cost
costOfGoods       // COGS for order/period
grossProfit       // Profit before expenses
```

---

## 📊 Boolean Field Naming

**Pattern**: `is{Property}` or `has{Property}`
```typescript
isAvailable       // Item is available
isActive          // Account/item is active
isMainBranch      // Is primary branch
hasRecipe         // Item has a recipe
hasDelivery       // Branch offers delivery
requiresApproval  // Needs approval
isPaid            // Payment completed
```

---

## 🔔 Event & Function Naming

**Pattern**: Verb-based
```typescript
// Event handlers
onOrderCreated()
onPaymentReceived()
onInventoryUpdated()

// Service functions
createOrder()
updateOrderStatus()
calculateCOGS()
deductInventory()
recordWaste()

// Query functions
getOrdersByStatus()
listActiveItems()
fetchDailyReport()
```

---

## 🏷️ URL Path Segments

**Pattern**: lowercase, hyphens for multi-word
```
/api/menu-items        // Not /api/menuItems
/api/raw-items         // Not /api/rawItems
/api/loyalty-cards     // Not /api/loyaltyCards
/api/accounting-reports // Not /api/accountingReports
```

---

## 📦 Module Organization

### Business Logic Modules
```typescript
// File: order-engine.ts
export class OrderEngine {
  create()
  updateStatus()
  cancel()
  calculateTotal()
}

// File: recipe-engine.ts
export class RecipeEngine {
  calculateCOGS()
  getIngredients()
  updateCost()
}

// File: inventory-engine.ts
export class InventoryEngine {
  deductStock()
  recordWaste()
  adjustStock()
}

// File: accounting-engine.ts
export class AccountingEngine {
  calculateDailySnapshot()
  recordTransaction()
}
```

---

## 🎨 UI Component Naming

**Pattern**: Descriptive, domain-specific
```typescript
OrderCard.tsx           // Displays order info
OrderStatusBadge.tsx    // Status indicator
MenuItemSelector.tsx    // Item selection component
CartSummary.tsx         // Cart overview
KitchenDisplay.tsx      // Kitchen display system
POSSystem.tsx           // Point of sale interface
```

---

## ✅ Quality Gate Rules

### No Magic Numbers
❌ BAD:
```typescript
if (profit > 100) { /* alert */ }
totalPrice = quantity * 25.5;
```

✅ GOOD:
```typescript
const PROFIT_ALERT_THRESHOLD = 100;
const COFFEE_BASE_PRICE = 25.5;
if (profit > PROFIT_ALERT_THRESHOLD) { /* alert */ }
totalPrice = quantity * COFFEE_BASE_PRICE;
```

### No Ambiguous Type Names
❌ BAD:
```typescript
interface Data { value: string; }
function process(x: any) { }
```

✅ GOOD:
```typescript
interface OrderData { customerName: string; }
function processOrder(order: IOrder): void { }
```

### Consistent Tense
✅ PAST TENSE for events/data:
```typescript
created, updated, deleted, received, processed
```

✅ IMPERATIVE for functions:
```typescript
create(), update(), delete(), process()
```

---

## 📋 Validation & Status Values

### Standardized Status Strings
```typescript
// Order statuses
"pending" | "confirmed" | "preparing" | "ready" | "delivered" | "completed" | "cancelled"

// Payment statuses
"pending" | "completed" | "refunded"

// User roles
"owner" | "manager" | "cashier" | "barista" | "delivery_driver" | "customer"

// Item availability
"available" | "unavailable" | "out_of_stock"
```

---

**Version**: 1.0
**Last Updated**: December 27, 2025
**Phase**: 0 (Standardization)
