/**
 * Phase 9 — In-process typed event bus.
 * Decouples writers from readers. Webhooks, audit logs, cache invalidation,
 * analytics, notifications can all subscribe without touching the writer.
 *
 * Usage:
 *   import { bus } from "./core/event-bus";
 *   bus.emit("order.created", { orderId, tenantId, branchId, total });
 *   bus.on("order.created", async (p) => { ... });
 */
import { nanoid } from "nanoid";
import type { EventName, EventPayloads, DomainEvent } from "@shared/core/contracts";

type Handler<E extends EventName> = (payload: EventPayloads[E], event: DomainEvent<E>) => void | Promise<void>;

interface BusStats {
  totalEmitted: number;
  totalHandled: number;
  totalErrors: number;
  byEvent: Record<string, { emitted: number; handled: number; errors: number }>;
  subscriberCount: Record<string, number>;
}

class TypedEventBus {
  private handlers = new Map<EventName, Set<Handler<any>>>();
  private stats: BusStats = {
    totalEmitted: 0,
    totalHandled: 0,
    totalErrors: 0,
    byEvent: {},
    subscriberCount: {},
  };

  on<E extends EventName>(name: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(name);
    if (!set) { set = new Set(); this.handlers.set(name, set); }
    set.add(handler as Handler<any>);
    this.stats.subscriberCount[name] = set.size;
    return () => this.off(name, handler);
  }

  off<E extends EventName>(name: E, handler: Handler<E>): void {
    const set = this.handlers.get(name);
    if (set) {
      set.delete(handler as Handler<any>);
      this.stats.subscriberCount[name] = set.size;
    }
  }

  emit<E extends EventName>(name: E, payload: EventPayloads[E]): DomainEvent<E> {
    const event: DomainEvent<E> = { name, payload, at: Date.now(), id: nanoid(12) };
    this.stats.totalEmitted++;
    this.bumpStat(name, "emitted");

    const set = this.handlers.get(name);
    if (set && set.size > 0) {
      for (const h of set) {
        try {
          const result = h(payload, event);
          if (result && typeof (result as any).then === "function") {
            (result as Promise<void>).then(
              () => { this.stats.totalHandled++; this.bumpStat(name, "handled"); },
              (err) => {
                this.stats.totalErrors++;
                this.bumpStat(name, "errors");
                console.error(`[bus] handler error for ${name}:`, err?.message || err);
              },
            );
          } else {
            this.stats.totalHandled++;
            this.bumpStat(name, "handled");
          }
        } catch (err: any) {
          this.stats.totalErrors++;
          this.bumpStat(name, "errors");
          console.error(`[bus] handler error for ${name}:`, err?.message || err);
        }
      }
    }
    return event;
  }

  private bumpStat(name: EventName, kind: "emitted" | "handled" | "errors") {
    const s = this.stats.byEvent[name] || (this.stats.byEvent[name] = { emitted: 0, handled: 0, errors: 0 });
    s[kind]++;
  }

  getStats(): BusStats {
    return JSON.parse(JSON.stringify(this.stats));
  }

  listSubscriptions() {
    return [...this.handlers.entries()].map(([name, set]) => ({ name, subscribers: set.size }));
  }
}

export const bus = new TypedEventBus();
