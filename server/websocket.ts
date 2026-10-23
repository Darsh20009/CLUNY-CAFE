import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { sendPushToEmployee, sendPushToCustomer } from "./push-service";
import { registerWSHooks } from "./notification-engine";

interface WSClient {
  ws:               WebSocket;
  type:             "kitchen" | "display" | "order-tracking" | "pos" | "inventory" | "delivery-driver" | "delivery-tracking" | "customer" | "pos-display" | "employee-tracking" | "manager-tracking";
  orderId?:         string;
  branchId?:        string;
  driverId?:        string;
  deliveryOrderId?: string;
  customerId?:      string;
  posId?:           string;
  userId?:          string;
  employeeId?:      string;
  attendanceId?:    string;
  dualPosTerminalId?: string;
  dualPosControlEnabled?: boolean;
  dualPosDisplayId?: string;
  dualPosDisplayNumber?: number;
  lastPing:         number;
  isAlive:          boolean;
  lastSeq:          number;  // last acknowledged sequence from this client
}

interface BufferedEvent {
  seq:       number;
  type:      string;
  data:      Record<string, any>;
  timestamp: number;
}

const EVENT_BUFFER_SIZE = 300; // keep last N events for replay on reconnect

class OrderWebSocketManager {
  private wss:              WebSocketServer | null = null;
  private clients:          Map<WebSocket, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private seq =             0;
  private eventBuffer:      BufferedEvent[] = [];

  // ── Sequence & Buffer ─────────────────────────────────────────────────────

  private nextSeq(): number {
    return ++this.seq;
  }

  private bufferEvent(seq: number, type: string, data: Record<string, any>) {
    this.eventBuffer.push({ seq, type, data, timestamp: Date.now() });
    if (this.eventBuffer.length > EVENT_BUFFER_SIZE) {
      this.eventBuffer.shift();
    }
  }

  /** Replay all buffered events with seq > lastSeq to a specific client */
  private replayMissed(ws: WebSocket, lastSeq: number) {
    const missed = this.eventBuffer.filter(e => e.seq > lastSeq);
    if (missed.length === 0) return;
    for (const ev of missed) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ seq: ev.seq, type: ev.type, timestamp: ev.timestamp, ...ev.data }));
        }
      } catch (_) {}
    }
    console.log(`[WS] Replayed ${missed.length} missed events (lastSeq=${lastSeq})`);
  }

  // ── Safe Send ─────────────────────────────────────────────────────────────

  private safeSend(ws: WebSocket, payload: string) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    } catch (_) {
      this.clients.delete(ws);
    }
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  setup(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const pathname = new URL(request.url || "", "http://localhost").pathname;
      if (pathname !== "/ws/orders") return;
      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit("connection", ws, request);
      });
    });

    this.wss.on("connection", (ws, _req) => {
      console.log("[WS] New client connected");

      const client: WSClient = {
        ws,
        type:      "display",
        lastPing:  Date.now(),
        isAlive:   true,
        lastSeq:   0,
      };
      this.clients.set(ws, client);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error("[WS] Error parsing message:", error);
        }
      });

      ws.on("close", (code, reason) => {
        console.log(`[WS] Client disconnected: ${code} ${reason || ''}`);
        const closingClient = this.clients.get(ws);
        if (closingClient?.type === "pos" && closingClient.branchId && closingClient.dualPosTerminalId) {
          this.unpairDualPosScreens(closingClient.branchId, closingClient.dualPosTerminalId);
        }
        if (closingClient?.type === "pos-display") {
          const pairedPos = closingClient.branchId && closingClient.dualPosTerminalId
            ? this.findDualPosTerminal(closingClient.branchId, closingClient.dualPosTerminalId)
            : undefined;
          if (pairedPos) {
            this.safeSend(pairedPos.ws, JSON.stringify({
              type: "dual_pos_display_status",
              payload: {
                event: "display_offline",
                displayId: closingClient.dualPosDisplayId,
                displayNumber: closingClient.dualPosDisplayNumber,
              },
            }));
          }
        }
        this.clients.delete(ws);
        if (closingClient?.type === "pos-display" && closingClient.branchId) {
          this.broadcastDualPosDisplayLists(closingClient.branchId);
        }
      });

      ws.on("error", (error) => {
        console.error("[WS] Client error:", error.message);
        this.clients.delete(ws);
        try { ws.terminate(); } catch (_) {}
      });

      ws.on("pong", () => {
        const client = this.clients.get(ws);
        if (client) { client.isAlive = true; client.lastPing = Date.now(); }
      });

      ws.send(JSON.stringify({ type: "welcome", timestamp: Date.now(), serverSeq: this.seq }));
    });

    this.startHeartbeat();
    console.log("✅ WebSocket server initialized at /ws/orders");
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  private startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      const now            = Date.now();
      const staleThreshold = 60_000;

      this.clients.forEach((client, ws) => {
        if (!client.isAlive || (now - client.lastPing > staleThreshold)) {
          console.log("[WS] Terminating stale client");
          this.clients.delete(ws);
          try { ws.terminate(); } catch (_) {}
          return;
        }
        client.isAlive = false;
        try {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        } catch (_) {
          this.clients.delete(ws);
        }
      });
    }, 30_000);
  }

  // ── Message Handler ───────────────────────────────────────────────────────

  private handleMessage(ws: WebSocket, message: { type: string; [key: string]: any }) {
    const client = this.clients.get(ws);
    if (client) { client.lastPing = Date.now(); client.isAlive = true; }

    switch (message.type) {
      case "subscribe":
        if (client) {
          const previousType = client.type;
          const previousBranchId = client.branchId;
          const previousTerminalId = client.dualPosTerminalId;
          const previousDisplayId = client.dualPosDisplayId;
          const previousDisplayNumber = client.dualPosDisplayNumber;
          const previousControlEnabled = client.dualPosControlEnabled === true;
          const nextBranchId = typeof message.branchId === "string" ? message.branchId : undefined;
          const nextTerminalId = typeof message.dualPosTerminalId === "string"
            ? message.dualPosTerminalId.slice(0, 100)
            : undefined;
          const nextDisplayId = typeof message.dualPosDisplayId === "string"
            ? message.dualPosDisplayId.slice(0, 100)
            : undefined;
          const nextClientType = message.clientType || "display";
          if (
            previousType === "pos" &&
            previousBranchId &&
            previousTerminalId &&
            (previousBranchId !== nextBranchId || previousTerminalId !== nextTerminalId || nextClientType !== "pos")
          ) {
            this.unpairDualPosScreens(previousBranchId, previousTerminalId);
          }
          if (
            previousType === "pos-display" &&
            previousBranchId &&
            previousTerminalId &&
            (previousBranchId !== nextBranchId || previousTerminalId !== nextTerminalId || previousDisplayId !== nextDisplayId || nextClientType !== "pos-display")
          ) {
            this.unpairOneDualPosScreen(client, previousBranchId, previousTerminalId);
          }
          client.type            = nextClientType;
          client.orderId         = message.orderId;
          client.branchId        = nextBranchId;
          client.driverId        = message.driverId;
          client.deliveryOrderId = message.deliveryOrderId;
          client.customerId      = message.customerId;
          client.userId          = message.userId || message.customerId;
          client.employeeId      = message.employeeId;
          client.attendanceId    = message.attendanceId;
          client.dualPosTerminalId = nextClientType === "pos-display" ? undefined : nextTerminalId;
          client.dualPosControlEnabled = nextClientType === "pos" &&
            previousType === "pos" &&
            previousBranchId === nextBranchId &&
            previousTerminalId === nextTerminalId
              ? previousControlEnabled
              : false;
          client.dualPosDisplayId = undefined;
          client.dualPosDisplayNumber = undefined;

          if (nextClientType === "pos-display" && nextBranchId && nextDisplayId) {
            const sameDisplaySession = previousType === "pos-display" &&
              previousBranchId === nextBranchId &&
              previousDisplayId === nextDisplayId;
            client.dualPosDisplayId = nextDisplayId;
            client.dualPosDisplayNumber = sameDisplaySession && previousDisplayNumber
              ? previousDisplayNumber
              : this.nextDualPosDisplayNumber();

            const requestedPos = nextTerminalId
              ? this.findDualPosTerminal(nextBranchId, nextTerminalId)
              : undefined;
            client.dualPosTerminalId = requestedPos ? nextTerminalId : undefined;
            client.dualPosControlEnabled = requestedPos?.dualPosControlEnabled === true;
          }
        }
        console.log(`[WS] Client subscribed as ${message.clientType} userId=${message.userId || message.customerId || "anon"}`);
        ws.send(JSON.stringify({ type: "subscribed", clientType: message.clientType, serverSeq: this.seq }));
        if (client?.type === "pos" && client.branchId) {
          this.sendDualPosDisplayList(client);
        }
        if (client?.type === "pos-display" && client.branchId && client.dualPosDisplayId) {
          this.safeSend(ws, JSON.stringify({
            type: "dual_pos_display_registered",
            payload: {
              displayId: client.dualPosDisplayId,
              displayNumber: client.dualPosDisplayNumber,
              paired: Boolean(client.dualPosTerminalId),
              terminalId: client.dualPosTerminalId,
            },
          }));
          if (client.dualPosTerminalId) {
            this.sendDualPosDisplayUpdate(client, {
              event: "terminal_status",
              online: true,
              enabled: client.dualPosControlEnabled === true,
              displayNumber: client.dualPosDisplayNumber,
              terminalId: client.dualPosTerminalId,
            });
          }
          this.broadcastDualPosDisplayLists(client.branchId);
        }
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      // ACK — client confirms it received a critical event
      case "ack":
        if (client && typeof message.seq === "number") {
          client.lastSeq = Math.max(client.lastSeq, message.seq);
        }
        break;

      // Replay — client requests missed events since lastSeq
      case "replay_from":
        if (typeof message.lastSeq === "number") {
          this.replayMissed(ws, message.lastSeq);
        }
        break;

      case "driver_location_update":
        if (client && client.type === "delivery-driver" && client.driverId) {
          this.broadcastDriverLocation(client.driverId, message.location, message.deliveryOrderId);
        }
        break;

      case "employee_location_update":
        if (client && client.type === "employee-tracking" && client.employeeId) {
          this.broadcastEmployeeLocation({
            employeeId:          client.employeeId,
            attendanceId:        client.attendanceId,
            branchId:            client.branchId,
            location:            message.location,
            isInsideBranch:      message.isInsideBranch,
            distanceFromBranch:  message.distanceFromBranch,
            employeeName:        message.employeeName,
            employeePhoto:       message.employeePhoto,
          });
        }
        break;

      case "pos_cart_update":
        if (client && client.type === "pos") {
          const payload = message.payload || Object.fromEntries(
            Object.entries(message).filter(([key]) => !["type", "seq", "timestamp"].includes(key)),
          );
          this.broadcastPosDisplay(payload, client.branchId);
          if (client.dualPosTerminalId) {
            this.broadcastDualPosDisplay(payload, client.branchId, client.dualPosTerminalId);
          }
        }
        break;

      case "dual_pos_payment_update":
        if (
          client?.type === "pos" &&
          client.branchId &&
          client.dualPosTerminalId &&
          ["cash_payment_due", "checkout_review", "checkout_review_cancelled"].includes(String(message.event))
        ) {
          const payload = message.payload && typeof message.payload === "object"
            ? message.payload
            : {};
          this.broadcastDualPosDisplay(
            { ...payload, event: message.event },
            client.branchId,
            client.dualPosTerminalId,
          );
        }
        break;

      case "dual_pos_control_update":
        if (client && client.type === "pos" && client.dualPosTerminalId) {
          client.dualPosControlEnabled = message.enabled === true;
          this.broadcastDualPosDisplay(
            { event: "control_mode", enabled: client.dualPosControlEnabled, online: true },
            client.branchId,
            client.dualPosTerminalId,
          );
        }
        break;

      case "dual_pos_request_state":
        if (client && client.type === "pos-display" && client.branchId && client.dualPosTerminalId) {
          const pairedPos = this.findDualPosTerminal(client.branchId, client.dualPosTerminalId);
          this.broadcastDualPosDisplay(
            {
              event: "terminal_status",
              online: !!pairedPos,
              enabled: pairedPos?.dualPosControlEnabled === true,
            },
            client.branchId,
            client.dualPosTerminalId,
          );
          this.forwardDualPosAction({ action: "request_state" }, client.branchId, client.dualPosTerminalId);
        }
        break;

      case "dual_pos_customer_action":
        if (client && client.type === "pos-display" && client.branchId && client.dualPosTerminalId) {
          const pairedPos = this.findDualPosTerminal(client.branchId, client.dualPosTerminalId);
          const action = message.payload?.action;
          if (pairedPos?.dualPosControlEnabled === true && (action === "add" || action === "set_quantity" || action === "clear_order")) {
            this.forwardDualPosAction(message.payload, client.branchId, client.dualPosTerminalId);
          }
        }
        break;

      case "dual_pos_list_displays":
        if (client?.type === "pos" && client.branchId) {
          this.sendDualPosDisplayList(client);
        }
        break;

      case "dual_pos_pair_display":
        if (client?.type === "pos" && client.branchId && client.dualPosTerminalId) {
          this.pairDualPosDisplay(client, String(message.displayId || "").slice(0, 100));
        }
        break;

      case "dual_pos_unpair_display":
        if (client?.type === "pos" && client.branchId && client.dualPosTerminalId) {
          this.unpairDualPosScreens(client.branchId, client.dualPosTerminalId);
          this.sendDualPosDisplayList(client);
        }
        break;

      case "dual_pos_unregister_display":
        if (
          client?.type === "pos-display" &&
          client.dualPosDisplayId &&
          (!message.displayId || message.displayId === client.dualPosDisplayId)
        ) {
          if (client.branchId && client.dualPosTerminalId) {
            this.unpairOneDualPosScreen(client, client.branchId, client.dualPosTerminalId);
          }
          const branchId = client.branchId;
          client.dualPosDisplayId = undefined;
          client.dualPosDisplayNumber = undefined;
          client.dualPosTerminalId = undefined;
          client.dualPosControlEnabled = false;
          if (branchId) this.broadcastDualPosDisplayLists(branchId);
        }
        break;

      case "dual_pos_activity":
        if (client?.type === "pos" && client.branchId && client.dualPosTerminalId) {
          this.broadcastDualPosDisplay(
            { event: "activity" },
            client.branchId,
            client.dualPosTerminalId,
          );
        }
        break;

      default:
        break;
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private cleanupStaleClients() {
    this.clients.forEach((client, ws) => {
      if (ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(ws);
      }
    });
  }

  // ── Broadcast Helpers ─────────────────────────────────────────────────────

  /** Build a sequenced message, add to replay buffer, return serialised string */
  private makeEvent(type: string, data: Record<string, any>): string {
    const seq  = this.nextSeq();
    const ts   = Date.now();
    const body = { seq, type, timestamp: ts, ...data };
    this.bufferEvent(seq, type, data);
    return JSON.stringify(body);
  }

  // ── Public Broadcast Methods ──────────────────────────────────────────────

  broadcastOrderUpdate(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("order_updated", { order });
    const orderBranchId = order.branchId;

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (
          client.type === "kitchen" ||
          client.type === "display"  ||
          client.type === "pos"      ||
          (client.type === "order-tracking" && client.orderId === order.id)
        ) {
          // Branch filter: send only to same branch (or when either side has no branchId)
          const branchMatches = !orderBranchId || !client.branchId || client.branchId === orderBranchId;
          if (branchMatches) this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastNewOrder(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("new_order", { order });
    const orderBranchId = String(order.branchId || "");

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "kitchen" || client.type === "display" || client.type === "pos") {
          // Never send a branch-assigned order to an unscoped terminal.
          // Legacy paid orders with no resolvable branch go only to global staff screens.
          const branchMatches = orderBranchId === "unassigned"
            ? client.branchId === "all"
            : orderBranchId
              ? client.branchId === orderBranchId || client.branchId === "all"
              : client.branchId === "main" || client.branchId === "all";
          if (branchMatches) this.safeSend(ws, message);
        }
      }
    });

    const isOnline = order.channel === "online" || (!order.channel && !order.employeeId);
    this.sendPushNotification({
      title: isOnline ? "طلب جديد أونلاين 🌐" : "طلب جديد ☕",
      body:  `طلب رقم #${order.orderNumber} بقيمة ${order.totalAmount} ر.س`,
      url:   "/employee/orders",
      orderId: order.id,
      branchId: orderBranchId === "unassigned" ? "all" : (orderBranchId || "main"),
      sound: true,
      isOnlineOrder: isOnline,
    });
  }

  private async sendPushNotification(payload: any) {
    try {
      await sendPushToEmployee(payload.branchId || "all", {
        title: payload.title,
        body:  payload.body,
        url:   payload.url || "/employee/orders",
        tag:   "new-order",
      });
    } catch (error) {
      console.error("[PUSH] Error sending push notification:", error);
    }
  }

  broadcastOrderReady(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("order_ready", { order });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (
          client.type === "display" ||
          (client.type === "order-tracking" && client.orderId === order.id)
        ) {
          this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastCarPreparationAlert(order: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("car_preparation_alert", { order });
    const orderBranchId = order.branchId;
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "pos" || client.type === "kitchen" || client.type === "display") {
          const branchMatches = !orderBranchId || !client.branchId || client.branchId === orderBranchId;
          if (branchMatches) this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastStockAlert(alert: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("stock_alert", { alert });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "inventory" || client.type === "display") {
          this.safeSend(ws, message);
        }
      }
    });
  }

  broadcastAlertResolved(alertId: string, branchId: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();
    const message = this.makeEvent("alert_resolved", { alertId, branchId });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "inventory" || client.type === "display") {
          this.safeSend(ws, message);
        }
      }
    });
  }

  getConnectionCount(): number { return this.clients.size; }

  broadcastDeliveryUpdate(deliveryOrder: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const orderId  = String(deliveryOrder.id  || deliveryOrder._id   || "");
    const driverId = String(deliveryOrder.driverId || deliveryOrder.driver?._id || "");
    const message  = this.makeEvent("delivery_updated", { deliveryOrder });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const isDriver  = client.type === "delivery-driver"   && client.driverId        && driverId && client.driverId        === driverId;
        const isTracker = client.type === "delivery-tracking" && client.deliveryOrderId && orderId  && client.deliveryOrderId === orderId;
        if (isDriver || isTracker) this.safeSend(ws, message);
      }
    });
  }

  broadcastDriverLocation(driverId: string, location: { lat: number; lng: number }, deliveryOrderId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normOrderId  = deliveryOrderId ? String(deliveryOrderId) : "";
    const normDriverId = String(driverId);
    const message      = this.makeEvent("driver_location", { driverId: normDriverId, location, deliveryOrderId: normOrderId });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const matchesOrder  = client.type === "delivery-tracking" && client.deliveryOrderId && normOrderId  && client.deliveryOrderId === normOrderId;
        const matchesDriver = client.type === "delivery-tracking" && client.driverId        && normDriverId && client.driverId        === normDriverId;
        if (matchesOrder || matchesDriver) this.safeSend(ws, message);
      }
    });
  }

  broadcastEmployeeLocation(data: {
    employeeId:         string;
    attendanceId?:      string;
    branchId?:          string;
    location:           { lat: number; lng: number };
    isInsideBranch:     boolean;
    distanceFromBranch: number;
    employeeName?:      string;
    employeePhoto?:     string;
  }) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = this.makeEvent("employee_location", { ...data });

    if (!data.isInsideBranch) {
      const alertMsg = this.makeEvent("employee_left_branch", {
        employeeId:         data.employeeId,
        employeeName:       data.employeeName,
        branchId:           data.branchId,
        location:           data.location,
        distanceFromBranch: data.distanceFromBranch,
      });
      this.clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN && client.type === "manager-tracking") {
          const branchMatch = !data.branchId || !client.branchId || client.branchId === data.branchId || client.branchId === "all";
          if (branchMatch) this.safeSend(ws, alertMsg);
        }
      });
    }

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "manager-tracking") {
        const branchMatch = !data.branchId || !client.branchId || client.branchId === data.branchId || client.branchId === "all";
        if (branchMatch) this.safeSend(ws, message);
      }
    });
  }

  broadcastNewDeliveryOrder(deliveryOrder: any, branchId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedBranchId = branchId ? String(branchId) : "";
    const message = this.makeEvent("new_delivery_order", { deliveryOrder });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "delivery-driver") {
        const branchMatches = !normalizedBranchId || (client.branchId && client.branchId === normalizedBranchId);
        if (branchMatches) this.safeSend(ws, message);
      }
    });
  }

  broadcastToBranch(branchId: string, data: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedBranchId = branchId && branchId !== "all" ? String(branchId) : "";
    const message = this.makeEvent(data.type || "branch_event", data);

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const branchMatches = !normalizedBranchId || (client.branchId && client.branchId === normalizedBranchId);
        if (branchMatches) this.safeSend(ws, message);
      }
    });
  }

  broadcastToCustomer(customerId: string, data: any) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const normalizedCustomerId = String(customerId);
    const message = JSON.stringify({ ...data, timestamp: Date.now() });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "customer" && client.customerId === normalizedCustomerId) {
        this.safeSend(ws, message);
      }
    });
  }

  private findDualPosTerminal(branchId: string, terminalId: string): WSClient | undefined {
    for (const client of this.clients.values()) {
      if (
        client.type === "pos" &&
        client.branchId === branchId &&
        client.dualPosTerminalId === terminalId
      ) return client;
    }
    return undefined;
  }

  private nextDualPosDisplayNumber(): number {
    this.cleanupStaleClients();
    const usedNumbers = new Set(
      [...this.clients.values()]
        .filter((client) => client.type === "pos-display" && Number.isInteger(client.dualPosDisplayNumber))
        .map((client) => client.dualPosDisplayNumber as number),
    );
    let displayNumber = 1;
    while (usedNumbers.has(displayNumber)) displayNumber += 1;
    return displayNumber;
  }

  private sendDualPosDisplayList(posClient: WSClient) {
    if (posClient.type !== "pos" || !posClient.branchId) return;
    this.cleanupStaleClients();
    const displays = [...this.clients.values()]
      .filter((display) =>
        display.type === "pos-display" &&
        display.branchId === posClient.branchId &&
        !!display.dualPosDisplayId &&
        Number.isInteger(display.dualPosDisplayNumber)
      )
      .map((display) => ({
        displayId: display.dualPosDisplayId,
        displayNumber: display.dualPosDisplayNumber,
        pairedToCurrentPos: Boolean(
          posClient.dualPosTerminalId &&
          display.dualPosTerminalId === posClient.dualPosTerminalId
        ),
        available: !display.dualPosTerminalId ||
          display.dualPosTerminalId === posClient.dualPosTerminalId,
      }))
      .sort((a, b) => (a.displayNumber || 0) - (b.displayNumber || 0));
    this.safeSend(posClient.ws, JSON.stringify({
      type: "dual_pos_display_list",
      payload: { displays },
    }));
  }

  private broadcastDualPosDisplayLists(branchId: string) {
    for (const client of this.clients.values()) {
      if (client.type === "pos" && client.branchId === branchId) {
        this.sendDualPosDisplayList(client);
      }
    }
  }

  private sendDualPosDisplayUpdate(display: WSClient, payload: any) {
    this.safeSend(display.ws, JSON.stringify({
      type: "dual_pos_display_update",
      payload,
      timestamp: Date.now(),
    }));
  }

  private unpairOneDualPosScreen(display: WSClient, branchId: string, terminalId: string) {
    if (
      display.type !== "pos-display" ||
      display.branchId !== branchId ||
      display.dualPosTerminalId !== terminalId
    ) return;
    this.sendDualPosDisplayUpdate(display, {
      event: "terminal_offline",
      displayNumber: display.dualPosDisplayNumber,
    });
    display.dualPosTerminalId = undefined;
    display.dualPosControlEnabled = false;
  }

  private unpairDualPosScreens(branchId: string, terminalId: string, exceptDisplayId?: string) {
    let changed = false;
    for (const display of this.clients.values()) {
      if (
        display.type === "pos-display" &&
        display.branchId === branchId &&
        display.dualPosTerminalId === terminalId &&
        display.dualPosDisplayId !== exceptDisplayId
      ) {
        this.unpairOneDualPosScreen(display, branchId, terminalId);
        changed = true;
      }
    }
    if (changed) this.broadcastDualPosDisplayLists(branchId);
  }

  private pairDualPosDisplay(posClient: WSClient, displayId: string) {
    if (!displayId || !posClient.branchId || !posClient.dualPosTerminalId) return;
    const display = [...this.clients.values()].find((candidate) =>
      candidate.type === "pos-display" &&
      candidate.branchId === posClient.branchId &&
      candidate.dualPosDisplayId === displayId
    );
    if (!display) {
      this.safeSend(posClient.ws, JSON.stringify({
        type: "dual_pos_display_pair_error",
        payload: { reason: "display_not_found" },
      }));
      return;
    }
    if (display.dualPosTerminalId && display.dualPosTerminalId !== posClient.dualPosTerminalId) {
      this.safeSend(posClient.ws, JSON.stringify({
        type: "dual_pos_display_pair_error",
        payload: { reason: "display_in_use", displayNumber: display.dualPosDisplayNumber },
      }));
      this.broadcastDualPosDisplayLists(posClient.branchId);
      return;
    }

    this.unpairDualPosScreens(posClient.branchId, posClient.dualPosTerminalId, displayId);
    display.dualPosTerminalId = posClient.dualPosTerminalId;
    display.dualPosControlEnabled = posClient.dualPosControlEnabled === true;
    this.sendDualPosDisplayUpdate(display, {
      event: "terminal_status",
      online: true,
      enabled: display.dualPosControlEnabled,
      displayNumber: display.dualPosDisplayNumber,
      terminalId: display.dualPosTerminalId,
    });
    this.safeSend(posClient.ws, JSON.stringify({
      type: "dual_pos_display_paired",
      payload: {
        displayId: display.dualPosDisplayId,
        displayNumber: display.dualPosDisplayNumber,
      },
    }));
    this.broadcastDualPosDisplayLists(posClient.branchId);
  }

  private broadcastDualPosDisplay(payload: any, branchId?: string, terminalId?: string) {
    if (!branchId || !terminalId) return;
    this.cleanupStaleClients();
    const message = JSON.stringify({ type: "dual_pos_display_update", payload, timestamp: Date.now() });
    this.clients.forEach((client, ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        client.type === "pos-display" &&
        client.branchId === branchId &&
        client.dualPosTerminalId === terminalId
      ) this.safeSend(ws, message);
    });
  }

  private forwardDualPosAction(payload: any, branchId: string, terminalId: string) {
    if (!this.findDualPosTerminal(branchId, terminalId)) return;
    const message = JSON.stringify({ type: "dual_pos_customer_action", payload, timestamp: Date.now() });
    this.clients.forEach((client, ws) => {
      if (
        ws.readyState === WebSocket.OPEN &&
        client.type === "pos" &&
        client.branchId === branchId &&
        client.dualPosTerminalId === terminalId
      ) this.safeSend(ws, message);
    });
  }

  broadcastPosDisplay(payload: any, branchId?: string) {
    if (!this.wss) return;
    this.cleanupStaleClients();

    const message = JSON.stringify({ type: "pos_cart_update", payload, timestamp: Date.now() });

    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN && client.type === "pos-display") {
        const branchMatches = !branchId || !client.branchId || client.branchId === branchId;
        if (branchMatches) this.safeSend(ws, message);
      }
    });
  }

  pushToUser(userId: string, data: any) {
    if (!this.wss || !userId) return;
    const message = JSON.stringify(data);
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.userId === userId || client.customerId === userId) {
          this.safeSend(ws, message);
        }
      }
    });
  }

  pushToAdmins(data: any) {
    if (!this.wss) return;
    const message = JSON.stringify(data);
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (client.type === "pos" || client.type === "kitchen" || client.type === "display") {
          this.safeSend(ws, message);
        }
      }
    });
  }

  getStats() {
    let total = 0, customers = 0, staff = 0, kitchen = 0, pos = 0;
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        total++;
        if (client.type === "customer" || client.type === "order-tracking") customers++;
        else if (client.type === "kitchen") kitchen++;
        else if (client.type === "pos" || client.type === "pos-display") pos++;
        else staff++;
      }
    });
    return { total, customers, staff, kitchen, pos };
  }

  shutdown() {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
    this.clients.forEach((_client, ws) => {
      try { ws.close(1001, "Server shutting down"); } catch (_) {}
    });
    this.clients.clear();
    this.wss?.close();
  }
}

export const wsManager = new OrderWebSocketManager();

registerWSHooks(
  (userId, data) => wsManager.pushToUser(userId, data),
  (data)         => wsManager.pushToAdmins(data)
);
