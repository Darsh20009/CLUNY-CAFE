/**
 * Phase 9 — Single source of truth for event contracts.
 * Used by both frontend and backend event buses.
 * Adding/changing an event here is a breaking change — bump versions.
 */

export type EventName =
  | "order.created"
  | "order.updated"
  | "order.completed"
  | "order.cancelled"
  | "payment.received"
  | "payment.refunded"
  | "customer.registered"
  | "customer.loggedIn"
  | "loyalty.pointsEarned"
  | "loyalty.pointsRedeemed"
  | "inventory.lowStock"
  | "inventory.updated"
  | "menu.itemCreated"
  | "menu.itemUpdated"
  | "menu.itemDeleted"
  | "employee.clockIn"
  | "employee.clockOut"
  | "cache.invalidated"
  | "system.error";

export interface EventPayloads {
  "order.created":      { orderId: string; tenantId: string; branchId: string; total: number };
  "order.updated":      { orderId: string; status: string; tenantId: string };
  "order.completed":    { orderId: string; tenantId: string; total: number };
  "order.cancelled":    { orderId: string; tenantId: string; reason?: string };
  "payment.received":   { orderId: string; amount: number; method: string };
  "payment.refunded":   { orderId: string; amount: number; reason?: string };
  "customer.registered":{ customerId: string; phone: string };
  "customer.loggedIn":  { customerId: string };
  "loyalty.pointsEarned":   { customerId: string; phone: string; points: number };
  "loyalty.pointsRedeemed": { customerId: string; phone: string; points: number };
  "inventory.lowStock":     { itemId: string; remaining: number; tenantId: string };
  "inventory.updated":      { itemId: string; quantity: number; tenantId: string };
  "menu.itemCreated":   { itemId: string; tenantId: string };
  "menu.itemUpdated":   { itemId: string; tenantId: string };
  "menu.itemDeleted":   { itemId: string; tenantId: string };
  "employee.clockIn":   { employeeId: string; at: number };
  "employee.clockOut":  { employeeId: string; at: number };
  "cache.invalidated":  { pattern: string };
  "system.error":       { source: string; message: string; meta?: any };
}

export interface DomainEvent<E extends EventName = EventName> {
  name: E;
  payload: EventPayloads[E];
  at: number;
  id: string;
}
