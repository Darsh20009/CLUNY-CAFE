# Café Operating System - Status & Flow Definitions
## Phase 0: Status Pipeline Documentation

### 📊 Order Status Pipeline

```
┌─────────────┐
│   PENDING   │  ← Order created, awaiting confirmation
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ CONFIRMED   │  ← Payment verified, kitchen notified
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PREPARING   │  ← Being prepared by barista/kitchen
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   READY     │  ← Ready for pickup/delivery
└──────┬──────┘
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
┌─────────────┐           ┌─────────────┐
│ DELIVERED   │ (Delivery)│ COLLECTED   │ (Pickup)
└──────┬──────┘           └──────┬──────┘
       │                         │
       └────────────┬────────────┘
                    │
                    ▼
           ┌─────────────────┐
           │   COMPLETED     │  ← Order finalized, profit recorded
           └─────────────────┘

CANCELLATION PATH (from any state except COMPLETED):
Any State ──────────▶ CANCELLED (with reason recorded)
```

### 💳 Payment Status Pipeline

```
┌─────────────┐
│   PENDING   │  ← Waiting for payment
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ COMPLETED   │  ← Payment received & verified
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼ (if refund needed)
   SUCCESS      ┌─────────────┐
                │  REFUNDED   │
                └─────────────┘
```

### 🏗️ State Machine Validation Rules

#### Allowed Transitions
| Current State | → Next State | Condition |
|---|---|---|
| PENDING | CONFIRMED | Payment successful |
| PENDING | CANCELLED | Customer/Staff cancels |
| CONFIRMED | PREPARING | Kitchen starts |
| PREPARING | READY | Item completed |
| READY | DELIVERED | Driver delivers |
| READY | COLLECTED | Customer picks up |
| DELIVERED/COLLECTED | COMPLETED | Order finalized |
| Any (except COMPLETED) | CANCELLED | Valid cancellation reason |

#### Forbidden Transitions
- COMPLETED → Any state
- CANCELLED → Any state (except reversal with admin override)
- COLLECTED → DELIVERED
- DELIVERED → COLLECTED

### 🔔 Status Transition Events

#### Event: Order Created
```
TRIGGER: POST /api/orders/create
NEW STATUS: PENDING
SIDE EFFECTS:
  - Send confirmation to customer
  - Create empty accounting snapshot
  - Reserve inventory (optional)
NOTIFICATION: Order confirmation email/SMS
```

#### Event: Order Confirmed
```
TRIGGER: Payment processed
NEW STATUS: CONFIRMED
SIDE EFFECTS:
  - Send to kitchen display system
  - Deduct inventory from stock
  - Create InventoryMovement records
NOTIFICATION: Push notification to barista
```

#### Event: Order Status → PREPARING
```
TRIGGER: Barista starts preparation
NEW STATUS: PREPARING
SIDE EFFECTS:
  - Update progress in kitchen display
NOTIFICATION: Update customer (ETA calculation)
```

#### Event: Order Status → READY
```
TRIGGER: Item completed by barista
NEW STATUS: READY
SIDE EFFECTS:
  - Remove from kitchen queue
  - Start delivery/pickup timer
NOTIFICATION: Alert customer for pickup / Assign driver
```

#### Event: Order Status → DELIVERED/COLLECTED
```
TRIGGER: Driver delivers OR customer collects
NEW STATUS: DELIVERED or COLLECTED
SIDE EFFECTS:
  - Verify delivery address (if delivery)
  - Trigger accounting snapshot creation
  - Award loyalty points (if applicable)
NOTIFICATION: Delivery confirmation
```

#### Event: Order Status → COMPLETED
```
TRIGGER: Order collected/delivered + no disputes
NEW STATUS: COMPLETED
SIDE EFFECTS:
  - Finalize profit calculation
  - Update daily accounting snapshot
  - Archive order
NOTIFICATION: Send receipt/invoice
```

#### Event: Order Cancelled
```
TRIGGER: Customer/Staff cancels
NEW STATUS: CANCELLED
SIDE EFFECTS:
  - Restore inventory to stock
  - Reverse loyalty points (if already awarded)
  - Mark InventoryMovement as cancelled
  - Calculate refund amount
  - Process refund (if payment was taken)
NOTIFICATION: Cancellation confirmation with refund info
REASON TYPES:
  - customer_request
  - item_unavailable
  - kitchen_issue
  - delivery_failed
  - admin_override
```

---

### 🏪 Branch Operating Status

```
┌──────────────┐
│    CLOSED    │  (Outside working hours)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    OPENING   │  (Opening procedure in progress)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│     OPEN     │  (Accepting orders, normal operation)
└──────┬───────┘
       │
       └─────────────────────────────┐
                                     │
                        (Can close anytime)
                                     │
                                     ▼
                            ┌──────────────┐
                            │    CLOSING   │  (Closing procedure)
                            └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │    CLOSED    │
                            └──────────────┘
```

---

### 🍽️ Dine-In Table Status

```
┌──────────┐
│  VACANT  │  ← Empty, available for customers
└────┬─────┘
     │
     ▼
┌──────────┐
│ OCCUPIED │  ← Customer seated
└────┬─────┘
     │
     ▼
┌──────────────┐
│ ORDER_PLACED │  ← Order submitted
└────┬─────────┘
     │
     ▼
┌──────────┐
│ PREPARING│  ← Order being prepared
└────┬─────┘
     │
     ▼
┌──────────┐
│ SERVING  │  ← Food on table
└────┬─────┘
     │
     ├─────────────────────┐
     │                     │
     ▼                     ▼
┌──────────┐        ┌──────────┐
│  PAYING  │        │ RESERVED │ (for next booking)
└────┬─────┘        └──────────┘
     │
     ▼
┌──────────┐
│  VACANT  │  ← Cleaned & ready for next customer
└──────────┘
```

---

### 👤 User/Employee Status

```
┌──────────┐
│  ACTIVE  │  ← Employee can log in & work
└────┬─────┘
     │
     ├──────────────────┐
     │                  │
     ▼                  ▼
┌──────────┐      ┌──────────┐
│ ON_LEAVE │      │SUSPENDED │  ← Temporarily restricted
└────┬─────┘      └────┬─────┘
     │                  │
     └──────────┬───────┘
                │
                ▼
         ┌──────────────┐
         │   INACTIVE   │  ← Cannot access system
         └──────────────┘
```

---

### 📦 Inventory Movement Types

| Type | Description | When | Impact |
|---|---|---|---|
| **PURCHASE** | Stock received from supplier | Purchase order fulfilled | Stock ↑ |
| **USAGE** | Stock consumed in order preparation | Order prepared | Stock ↓, COGS ↑ |
| **WASTE** | Stock damaged/expired/spoiled | Documented waste | Stock ↓, Waste ↑ |
| **ADJUSTMENT** | Manual correction (count mismatch) | Physical inventory audit | Stock ±, Discrepancy recorded |
| **TRANSFER** | Stock moved between branches | Inter-branch transfer | Stock moved, Cost tracked |

---

### 💰 Financial Status Snapshots

**Frequency**: Daily, Weekly, Monthly

**Triggered By**:
1. End of business day (automatic)
2. End of week (automatic, Sunday midnight)
3. End of month (automatic, 1st of month)
4. Manual trigger by manager

**Calculated Fields**:
- Total Revenue = Sum of completed orders
- COGS = Sum of recipe costs for delivered items
- Gross Profit = Revenue - COGS
- Waste Cost = Sum of waste inventory movements
- Waste % = (Waste Cost / COGS) × 100

---

### ✅ Validation Rules by Status

#### PENDING Order
- ✓ All items must have valid prices
- ✓ No inventory deduction yet
- ✓ Can be cancelled without restrictions

#### CONFIRMED Order
- ✓ Payment completed
- ✓ Inventory deducted
- ✓ COGS calculated
- ✓ Cannot modify items

#### CANCELLED Order
- ✓ Inventory restored
- ✓ Points reversed
- ✓ Refund processed
- ✓ Cannot modify cancellation

#### COMPLETED Order
- ✓ Final profit calculated
- ✓ Archived (read-only)
- ✓ Counts toward accounting

---

**Documentation Version**: 1.0
**Last Updated**: December 27, 2025
**Phase**: 0 (Definition & Validation)
