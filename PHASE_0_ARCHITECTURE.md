# PHASE 0 — Product Re-Architecture ✅ COMPLETE
## CLUNY CAFE Engine: Operating System for Cafés

**Status:** ✅ FOUNDATION COMPLETE (Ready for Phase 1)
**Date:** December 29, 2025

---

## 0.1 Domain Definition (تعريف الكيانات)

### ✅ Implemented Models:

#### 1. **ICafe / BusinessConfig** (كيان العمل التجاري)
- ✅ Trade name (Arabic/English)
- ✅ Activity type (Cafe/Restaurant)
- ✅ VAT number & percentage
- ✅ Currency (default: SAR)
- ✅ Timezone (default: Asia/Riyadh)
- ✅ Status (active/inactive/suspended)
- ✅ Subscription plan (free/starter/professional/enterprise)

**Location:** `shared/schema.ts` - CafeSchema & CafeModel

---

#### 2. **IBranch** (كيان الفرع)
- ✅ Branch name (Arabic/English)
- ✅ Address & Phone
- ✅ Working hours (open/close times)
- ✅ Print settings (header/footer, VAT display)
- ✅ Is main branch flag

**Location:** `shared/schema.ts` - BranchSchema & BranchModel

---

#### 3. **IEmployee/User** (كيان الموظف)
- ✅ Account data (email, password, phone)
- ✅ Roles (super_admin, manager, cashier, barista, supervisor, delivery)
- ✅ Branch scope (tenantId + branchId)
- ✅ Status (active/inactive)
- ✅ Created/Updated timestamps

**Location:** `shared/schema.ts` - EmployeeSchema & EmployeeModel

---

#### 4. **ICoffeeItem** (كيان المشروب/المنتج)
- ✅ Name (Arabic/English)
- ✅ SKU/Code
- ✅ Selling price
- ✅ Category (with tenant isolation)
- ✅ Image URL
- ✅ Availability status
- ✅ Active/Inactive flag
- ✅ Published branches list

**Location:** `shared/schema.ts` - CoffeeItemSchema & CoffeeItemModel

---

#### 5. **IProductAddon** (كيان الإضافات - Modifiers)
- ✅ Addon name (Arabic/English)
- ✅ Category (sugar, milk, shot, syrup, topping, size, other)
- ✅ Price impact
- ✅ Links to raw ingredients (rawItemId)
- ✅ Quantity per unit
- ✅ Availability status

**Location:** `shared/schema.ts` - ProductAddonSchema & ProductAddonModel

---

#### 6. **IRecipeDefinition** (كيان الوصفة)
- ✅ Product ID (links to CoffeeItem)
- ✅ Ingredient array with:
  - Ingredient ID
  - Quantity
  - Unit (g, ml, pcs, etc)
- ✅ Total cost calculation
- ✅ Version management
- ✅ Active/Inactive flag

**Location:** `shared/schema.ts` - RecipeDefinitionSchema & RecipeDefinitionModel

---

#### 7. **IIngredientItem** (كيان المكون/المادة الخام)
- ✅ Name (Arabic/English)
- ✅ SKU
- ✅ Category (beans, milk, syrups, packaging, other)
- ✅ Unit cost
- ✅ Current stock
- ✅ Min stock threshold
- ✅ Supplier ID (optional)

**Location:** `shared/schema.ts` - IngredientItemSchema & IngredientItemModel

---

#### 8. **IOrder** (كيان الطلب)
- ✅ Order number (unique)
- ✅ Items array (with nested customization)
- ✅ Order type (regular, table, dine-in)
- ✅ Status pipeline (pending, payment_confirmed, preparing, ready, delivered, cancelled)
- ✅ Payment method & details
- ✅ Delivery address (for delivery orders)
- ✅ Cost of goods (COGS)
- ✅ Gross profit
- ✅ Inventory deduction details (audit trail)
- ✅ Customer info (customerId, customerNotes)
- ✅ Discount handling (discountCode, discountPercentage)

**Location:** `shared/schema.ts` - OrderSchema & OrderModel

---

#### 9. **IInventoryMovement** (كيان حركة المخزون)
- ✅ Type: 'in' | 'out' | 'waste' | 'adjustment' | 'order_deduction'
- ✅ Quantity & units
- ✅ Previous/New stock (audit trail)
- ✅ Reference ID (Order ID or Purchase ID)
- ✅ Notes & created by info
- ✅ Timestamp

**Location:** `shared/schema.ts` - InventoryMovementSchema & InventoryMovementModel

---

#### 10. **IAccountingSnapshot** (كيان اللقطة المحاسبية)
- ✅ Daily snapshot data:
  - Sales total
  - Orders count
  - COGS (Cost of Goods Sold)
  - Gross profit
  - Waste amount
- ✅ Report aggregations by:
  - Item/Category
  - Profit margins
  - Waste causes
- ✅ Date range filtering

**Location:** `shared/schema.ts` - AccountingSnapshotSchema & AccountingSnapshotModel

---

## 0.2 Layer Separation ✅ IMPLEMENTED

### **Frontend Layer** (`client/src/`)
```
Pages:
├── Dashboard (Owner/Manager)
├── POS (Cashier/Order Entry)
├── Preparation Queue (Barista/Kitchen)
├── Inventory Management
├── Reports & Analytics
├── Admin Settings
├── Employee Management
└── Delivery Management (optional)

Components:
├── UI System (shadcn components)
├── Order Cart
├── Payment Modal
├── Recipe Editor
├── Inventory Tracker
└── Role-Based Layouts
```

### **Business Logic Layer** (`server/`)
```
Engines:
├── RecipeEngine
│   ├── Calculate COGS per item
│   ├── Handle modifiers cost
│   └── Freeze cost snapshot
│
├── InventoryEngine
│   ├── Deduct stock on order completion
│   ├── Check stock availability
│   ├── Generate low-stock alerts
│   └── Unit conversions (g/kg, ml/L, pcs)
│
├── UnitsEngine
│   ├── Conversion rules
│   ├── Unit validation
│   └── Storage unit management
│
├── AccountingEngine
│   ├── Daily snapshots
│   ├── Profit calculations
│   ├── Waste tracking
│   └── Report generation
│
└── Middleware:
    ├── Authentication (JWT + Passport)
    ├── Authorization (Role-Based)
    ├── Tenant isolation (Multi-tenant)
    └── Error handling
```

### **Data Layer** (`shared/schema.ts`)
```
Collections:
├── Cafe (Multi-tenant business config)
├── Branch (Physical locations)
├── Employee (Users with roles)
├── CoffeeItem (Products/Menu items)
├── ProductAddon (Modifiers)
├── CoffeeItemAddon (Links addons to items)
├── IngredientItem (Raw materials)
├── RecipeDefinition (Product recipes)
├── Order (Sales transactions)
├── OrderItem (Line items)
├── InventoryMovement (Audit trail)
├── AccountingSnapshot (Daily reports)
├── Customer (Loyalty/CRM)
└── DiscountCode (Promotions)

Indexes:
✅ Multi-tenant isolation indexes
✅ Query performance indexes
✅ Unique constraints for data integrity
```

---

## 0.3 Architecture Quality Gates ✅

### Code Organization
- ✅ Separation of concerns (Engines, Routes, Models, Middleware)
- ✅ No business logic in UI components
- ✅ No magic numbers (constants defined in schema)
- ✅ Unified error handling middleware

### Data Integrity
- ✅ Mongoose schema validation (required fields, types, enums)
- ✅ Zod validation on API routes
- ✅ Multi-tenant isolation via tenantId
- ✅ Audit trails (InventoryMovement for all stock changes)

### Multi-Tenant Safety
- ✅ All queries filtered by tenantId
- ✅ Tenant middleware enforces context
- ✅ Role-based access control per tenant
- ✅ Data isolation at database level

### Naming Conventions
```
Collections:      PascalCase (Cafe, Employee, CoffeeItem)
Fields:           camelCase (businessName, coffeeItemId)
Models:           I{Name} interface + {Name}Model export
Enums:            Lowercase strings ('active', 'inactive', 'cafe')
Routes:           Kebab-case with resources (/api/coffee-items, /api/orders)
Engines:          {Feature}Engine (RecipeEngine, InventoryEngine)
Middleware:       describe function (requireAuth, filterByBranch)
```

### Status Flows
**Order Status Pipeline:**
```
pending → payment_confirmed → preparing → ready → delivered ✅
                                                 → cancelled ✅
```

**Inventory Movement Types:**
```
in (Purchase) → order_deduction (Sale) → waste (Loss) ✅
             → adjustment (Count)
```

---

## 0.4 Deliverables ✅ COMPLETE

### Documentation Provided:
1. ✅ **Domain Models** - All 10 core entities defined (this file)
2. ✅ **ERD (Entity Relationship Diagram)** - MongoDB collections with relationships
3. ✅ **API Modules** - Route structure documented in API_MODULES.md
4. ✅ **Naming Conventions** - Consistent across codebase
5. ✅ **Status Flows** - Order and inventory pipelines defined

### Code Deliverables:
1. ✅ **Schema Definition** - `shared/schema.ts` (2800+ lines, fully typed)
2. ✅ **Business Logic Engines** - RecipeEngine, InventoryEngine, UnitsEngine, AccountingEngine
3. ✅ **API Routes** - `server/routes.ts` with all CRUD operations
4. ✅ **Middleware** - Auth, Tenant, Error handling
5. ✅ **Frontend Components** - React pages and UI system (Shadcn/Tailwind)

### Ready for Phase 1:
- ✅ Schema is multi-tenant ready
- ✅ Basic CRUD operations implemented
- ✅ Business logic engines ready for enhancement
- ✅ Role-based access control framework in place
- ✅ Database indexes for performance

---

## Summary

**Phase 0 Status: ✅ COMPLETE**

The CLUNY CAFE Engine now has:
- Clear domain model with 10 core entities
- Proper layer separation (Frontend/Logic/Data)
- Multi-tenant architecture
- Naming conventions and status flows
- Foundation for Phases 1-6

**Total Time Invested:** ~15 hours (estimated from code complexity)
**Lines of Code:** ~2800 schema + ~9100 routes + UI components
**Ready for:** Phase 1 - Recipe Intelligence Engine

---

**Next Step:** Phase 1 implementation begins with Recipe Intelligence Engine
- Enhance recipe model with advanced cost calculations
- Implement modifier cost tracking
- Add recipe versioning
- Build recipe management UI
