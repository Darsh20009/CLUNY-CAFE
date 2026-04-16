# Café Operating System - Domain Models Documentation
## Phase 0: Product Re-Architecture

### 📋 Core Entities Definition

#### 0.1.1 Cafe/Business Entity
```typescript
ICafe {
  id: string (UUID)
  nameAr: string
  nameEn: string
  type: 'demo' | 'client'
  status: 'active' | 'inactive' | 'suspended'
  
  // Business Information
  businessName: string
  businessPhone: string
  businessEmail: string
  taxNumber?: string
  vatPercentage: number (default: 15 for SA)
  currency: string (default: SAR)
  timezone: string (default: Asia/Riyadh)
  
  // Features & Subscription
  subscriptionPlan: 'free' | 'starter' | 'professional' | 'enterprise'
  features: {
    inventoryTracking: boolean
    loyaltyProgram: boolean
    zatcaCompliance: boolean
    advancedAnalytics: boolean
    customTheme: boolean
  }
  
  // Branding
  customBranding?: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
  }
  
  timestamps: createdAt, updatedAt
}
```

#### 0.1.2 Branch Entity
```typescript
IBranch {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  nameAr: string
  nameEn?: string
  address: string
  phone: string
  
  workingHours: {
    open: string (HH:MM)
    close: string (HH:MM)
  }
  
  isMainBranch: boolean
  
  printSettings?: {
    headerText?: string
    footerText?: string
    showVat: boolean
  }
  
  timestamps: createdAt
}
```

#### 0.1.3 User Entity
```typescript
IUser {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  branchId?: string (FK → Branch) // For branch-scoped users
  
  phone: string
  email?: string
  password: string (hashed)
  
  role: 'owner' | 'manager' | 'cashier' | 'barista' | 'kitchen_staff' | 'delivery_driver'
  status: 'active' | 'inactive' | 'suspended'
  
  personalInfo: {
    nameAr: string
    nameEn?: string
    avatar?: string
  }
  
  // Permission scope
  assignedBranches?: string[] // For users who can access multiple branches
  
  timestamps: createdAt, updatedAt, lastLogin
}
```

#### 0.1.4 Menu Entity
```typescript
IMenuItem {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  nameAr: string
  nameEn?: string
  description?: string
  
  category: string (Coffee, Sandwich, Pastry, etc.)
  price: number
  oldPrice?: number (for promotional pricing)
  
  imageUrl?: string
  
  availability: {
    isAvailable: boolean
    branchAvailability: Array<{
      branchId: string
      isAvailable: boolean
    }>
  }
  
  // Recipe relationship
  recipeId?: string (FK → Recipe) // For items with recipes
  
  timestamps: createdAt, updatedAt
}

IModifier {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  nameAr: string
  nameEn?: string
  category: 'size' | 'milk' | 'syrup' | 'topping' | 'shot' | 'sugar' | 'other'
  price: number
  
  // Link to raw ingredient
  rawItemId?: string (FK → RawItem)
  quantityPerUnit?: number
  unit?: string
  
  timestamps: createdAt
}
```

#### 0.1.5 Order Entity
```typescript
IOrder {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  branchId: string (FK → Branch)
  
  orderNumber: string (unique per cafe)
  
  // Order composition
  items: OrderItem[] {
    menuItemId: string
    quantity: number
    unitPrice: number
    modifiers: Modifier[]
    specialNotes?: string
  }
  
  // Order metadata
  orderType: 'dine-in' | 'takeaway' | 'delivery'
  tableNumber?: string (for dine-in)
  
  // Status pipeline
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'completed' | 'refunded'
  
  // Customer info
  customerId?: string (FK → Customer)
  customerPhone?: string
  customerName?: string
  
  // Pricing
  subtotal: number
  tax: number (calculated from Cafe.vatPercentage)
  discountAmount?: number
  deliveryFee?: number
  totalAmount: number
  
  // Financial tracking
  costOfGoods?: number (COGS)
  profit?: number (totalAmount - costOfGoods)
  
  // Assignment
  assignedCashierId?: string
  assignedBarista?: string
  driverId?: string (for delivery)
  
  timestamps: createdAt, updatedAt, completedAt, deliveredAt
}
```

#### 0.1.6 Ingredient/RawItem Entity
```typescript
IRawItem {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  nameAr: string
  nameEn?: string
  
  // Inventory tracking
  unit: string (ml, g, pieces, etc.)
  costPerUnit: number
  currentStock: number
  minThreshold: number
  maxCapacity: number
  
  // Supplier
  supplierId?: string (FK → Supplier)
  lastPurchasePrice?: number
  lastPurchaseDate?: Date
  
  // Categorization
  category: 'coffee_bean' | 'milk' | 'syrup' | 'topping' | 'cup' | 'other'
  
  status: 'active' | 'inactive' | 'discontinued'
  
  timestamps: createdAt, updatedAt
}
```

#### 0.1.7 Recipe Entity
```typescript
IRecipe {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  nameAr: string
  nameEn?: string
  
  menuItemId?: string (FK → MenuItem) // Optional: recipe may be template
  
  // Recipe composition
  ingredients: RecipeIngredient[] {
    rawItemId: string (FK → RawItem)
    quantity: number
    unit: string
    cost: number (calculated: costPerUnit * quantity)
  }
  
  // Calculated fields
  totalCost: number (sum of all ingredient costs)
  
  // Versioning
  version: number
  isActive: boolean
  
  timestamps: createdAt, updatedAt
}
```

#### 0.1.8 Inventory Movement Entity
```typescript
IInventoryMovement {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  rawItemId: string (FK → RawItem)
  branchId?: string (FK → Branch)
  
  type: 'purchase' | 'usage' | 'waste' | 'adjustment' | 'transfer'
  
  // Movement details
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
  
  reference: {
    orderId?: string (for 'usage')
    purchaseOrderId?: string (for 'purchase')
    notes?: string
  }
  
  recordedBy: string (userId)
  
  timestamps: createdAt
}
```

#### 0.1.9 Accounting Snapshot Entity
```typescript
IAccountingSnapshot {
  id: string (UUID)
  cafeId: string (FK → Cafe)
  
  period: {
    startDate: Date
    endDate: Date
    type: 'daily' | 'weekly' | 'monthly'
  }
  
  // Revenue
  totalRevenue: number
  
  // Costs
  costOfGoods: number (sum of all COGS from orders)
  totalWaste: number
  
  // Profit
  grossProfit: number (totalRevenue - costOfGoods)
  
  // Breakdown by branch (if multi-branch)
  byBranch?: Array<{
    branchId: string
    revenue: number
    cogs: number
    profit: number
  }>
  
  // Breakdown by menu item (optional)
  topItems?: Array<{
    itemId: string
    quantity: number
    revenue: number
  }>
  
  timestamps: createdAt
}
```

---

### 📊 Status Pipelines

#### Order Status Flow
```
pending → confirmed → preparing → ready → delivered/collected → completed
                    ↓
                 cancelled (from any stage)
```

#### Payment Status Flow
```
pending → completed
       ↓
      refunded (if needed)
```

---

### 🏗️ Architecture Layers

#### Frontend Layer (`client/src`)
- **Pages**: User-facing interfaces
- **Components**: Reusable UI components
- **Hooks**: Custom React hooks
- **Lib**: Client-side utilities

#### Business Logic Layer (`server`)
- **Routes**: API endpoints
- **Storage**: Data access interface
- **Middleware**: Auth, tenant, etc.

#### Data Layer
- **MongoDB**: Primary data store
- **Models**: Mongoose schemas

---

### 📋 Naming Conventions

**Interfaces**: `I{EntityName}` (e.g., `ICafe`, `IOrder`)
**Models**: `{EntityName}Model` (e.g., `CafeModel`, `OrderModel`)
**Schemas**: `{EntityName}Schema` (e.g., `CafeSchema`, `OrderSchema`)
**Routes**: Verb-based `/api/entity/action` (e.g., `/api/orders/create`)

---

### 🔒 Quality Gates (Phase 0.3)

- ✅ All domain entities defined with interfaces
- ✅ MongoDB schemas created with proper indexes
- ✅ Foreign key relationships documented
- ⏳ API routes for CRUD operations (Phase 1)
- ⏳ Unified error handling (Phase 1)
- ⏳ Validation schemas using Zod (Phase 1)
- ⏳ Unit tests for business logic (Phase 2)

---

### 📦 Phase 0 Deliverables Status

- ✅ 0.1: Domain Models Defined
- ✅ 0.2: Layer Separation Documented
- ✅ 0.3: Quality Gate Framework Established
- ✅ 0.4: Naming Conventions Defined
- ✅ Domain Models Documentation (this file)
- ⏳ ERD Diagram (requires graphical tool)
- ⏳ API Modules List (Phase 1)
- ⏳ Comprehensive routing structure (Phase 1)

---

**Phase 0 Progress**: 75% Complete
**Next**: Phase 1 - API Routes Implementation
