/**
 * CLUNY Payment Terminal Integration Layer
 * ----------------------------------------
 * Unified abstraction over all payment terminal SDKs/APIs.
 * Each provider implements TerminalDriver.
 * The service routes pay() / refund() / cancel() to the active driver.
 *
 * Supported drivers:
 *  - geidea      : Geidea HPP / SDK
 *  - mada        : Mada direct terminal (local LAN)
 *  - stcbank     : STC Bank Pay API
 *  - foodicspay  : Foodics Pay integration
 *  - rajhi       : Al Rajhi Bank POS SDK
 *  - ahli        : Al Ahli Bank terminal
 *  - manual      : Fallback — cashier confirms manually
 */

import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DriverId = "geidea" | "mada" | "stcbank" | "foodicspay" | "rajhi" | "ahli" | "manual";

export interface PayRequest {
  amount: number;          // SAR
  currency?: string;       // default "SAR"
  orderId?: string;
  description?: string;
  cashierId?: string;
  branchId?: string;
  callbackUrl?: string;
}

export interface PayResponse {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  cardBrand?: string;
  last4?: string;
  receiptData?: Record<string, any>;
  error?: string;
  rawResponse?: any;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  error?: string;
}

export type TerminalStatus = "online" | "offline" | "busy" | "error" | "unknown";

export interface TerminalInfo {
  id: DriverId;
  nameAr: string;
  nameEn: string;
  status: TerminalStatus;
  lastChecked: Date;
  configured: boolean;
  features: string[];
}

export interface TerminalTransaction {
  id: string;
  driverId: DriverId;
  orderId?: string;
  amount: number;
  currency: string;
  status: "pending" | "success" | "failed" | "refunded" | "cancelled";
  transactionId?: string;
  authCode?: string;
  cardBrand?: string;
  last4?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  cashierId?: string;
  branchId?: string;
}

// ─── Base Driver Interface ─────────────────────────────────────────────────────

export interface TerminalDriver {
  id: DriverId;
  nameAr: string;
  nameEn: string;
  features: string[];
  isConfigured(): boolean;
  getStatus(): Promise<TerminalStatus>;
  pay(req: PayRequest): Promise<PayResponse>;
  refund(req: RefundRequest): Promise<RefundResponse>;
  cancel(transactionId?: string): Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(prefix = "txn"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Driver: Manual (Fallback) ────────────────────────────────────────────────

class ManualDriver implements TerminalDriver {
  id: DriverId = "manual";
  nameAr = "دفع يدوي";
  nameEn = "Manual Confirmation";
  features = ["card", "cash", "refund"];

  isConfigured() { return true; }
  async getStatus(): Promise<TerminalStatus> { return "online"; }

  async pay(req: PayRequest): Promise<PayResponse> {
    return {
      success: true,
      transactionId: makeId("man"),
      receiptData: { note: "Manual confirmation", amount: req.amount },
    };
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    return { success: true, refundId: makeId("ref") };
  }

  async cancel(): Promise<void> {}
}

// ─── Driver: Geidea ───────────────────────────────────────────────────────────

interface GeideaConfig {
  merchantId: string;
  apiPassword: string;
  publicKey: string;
  baseUrl?: string;
}

class GeideaDriver implements TerminalDriver {
  id: DriverId = "geidea";
  nameAr = "Geidea";
  nameEn = "Geidea";
  features = ["card", "apple_pay", "samsung_pay", "refund", "hpp"];
  private cfg: GeideaConfig;

  constructor(cfg: GeideaConfig) { this.cfg = cfg; }

  isConfigured() {
    return !!(this.cfg.merchantId && this.cfg.apiPassword);
  }

  async getStatus(): Promise<TerminalStatus> {
    if (!this.isConfigured()) return "offline";
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.merchant.geidea.net"}/payment-intent/api/v2/direct/health`, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      return resp.ok ? "online" : "error";
    } catch {
      return "offline";
    }
  }

  async pay(req: PayRequest): Promise<PayResponse> {
    if (!this.isConfigured()) return { success: false, error: "Geidea غير مُهيّأ" };
    try {
      const orderId = req.orderId || makeId("geo");
      const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
      const payload = {
        amount: req.amount,
        currency: req.currency || "SAR",
        merchantReferenceId: orderId,
        timestamp,
        description: req.description || "CLUNY CAFE Order",
        callbackUrl: req.callbackUrl || `${process.env.SITE_URL || ""}/api/payments/geidea/callback`,
      };
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.merchant.geidea.net"}/payment-intent/api/v2/direct/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.cfg.merchantId}:${this.cfg.apiPassword}`).toString("base64")}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json();
      if (!resp.ok) return { success: false, error: data.detailedResponseMessage || data.responseMessage || "Geidea error", rawResponse: data };
      return {
        success: data.responseCode === "000" || resp.ok,
        transactionId: data.orderId || orderId,
        authCode: data.authorizationCode,
        cardBrand: data.paymentMethod?.brand,
        last4: data.paymentMethod?.maskedCardNumber?.slice(-4),
        receiptData: data,
        rawResponse: data,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    if (!this.isConfigured()) return { success: false, error: "Geidea غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.merchant.geidea.net"}/payment-intent/api/v2/direct/order/${req.transactionId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${this.cfg.merchantId}:${this.cfg.apiPassword}`).toString("base64")}`,
        },
        body: JSON.stringify({ amount: req.amount, reason: req.reason }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json();
      return { success: resp.ok, refundId: data.refundId, error: resp.ok ? undefined : data.detailedResponseMessage };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async cancel(): Promise<void> {}
}

// ─── Driver: Mada (Local LAN Terminal) ────────────────────────────────────────

interface MadaConfig {
  terminalIp: string;
  terminalPort?: number;
  merchantId?: string;
}

class MadaDriver implements TerminalDriver {
  id: DriverId = "mada";
  nameAr = "مدى";
  nameEn = "Mada";
  features = ["card", "contactless", "refund", "lan"];
  private cfg: MadaConfig;

  constructor(cfg: MadaConfig) { this.cfg = cfg; }

  isConfigured() { return !!(this.cfg.terminalIp); }

  async getStatus(): Promise<TerminalStatus> {
    if (!this.isConfigured()) return "offline";
    // Ping the local terminal IP
    try {
      const port = this.cfg.terminalPort || 8080;
      const resp = await fetch(`http://${this.cfg.terminalIp}:${port}/status`, {
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok ? "online" : "error";
    } catch {
      return "offline";
    }
  }

  async pay(req: PayRequest): Promise<PayResponse> {
    if (!this.isConfigured()) return { success: false, error: "مدى: عنوان الجهاز غير مُهيّأ" };
    const port = this.cfg.terminalPort || 8080;
    try {
      const resp = await fetch(`http://${this.cfg.terminalIp}:${port}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(req.amount * 100),
          currency: req.currency || "SAR",
          merchantId: this.cfg.merchantId,
          referenceId: req.orderId || makeId("mada"),
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      return {
        success: data.responseCode === "00" || data.approved === true,
        transactionId: data.transactionId || data.rrn,
        authCode: data.authCode,
        cardBrand: data.cardScheme || "Mada",
        last4: data.pan?.slice(-4),
        receiptData: data,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    if (!this.isConfigured()) return { success: false, error: "مدى: عنوان الجهاز غير مُهيّأ" };
    const port = this.cfg.terminalPort || 8080;
    try {
      const resp = await fetch(`http://${this.cfg.terminalIp}:${port}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(req.amount * 100),
          transactionId: req.transactionId,
          reason: req.reason,
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      return { success: data.responseCode === "00" || data.approved === true, refundId: data.refundId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async cancel(transactionId?: string): Promise<void> {
    if (!this.isConfigured()) return;
    const port = this.cfg.terminalPort || 8080;
    try {
      await fetch(`http://${this.cfg.terminalIp}:${port}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {}
  }
}

// ─── Driver: STC Bank ─────────────────────────────────────────────────────────

interface STCBankConfig {
  apiKey: string;
  merchantId: string;
  baseUrl?: string;
}

class STCBankDriver implements TerminalDriver {
  id: DriverId = "stcbank";
  nameAr = "STC Bank";
  nameEn = "STC Bank";
  features = ["card", "stc_pay", "refund", "qr"];
  private cfg: STCBankConfig;

  constructor(cfg: STCBankConfig) { this.cfg = cfg; }

  isConfigured() { return !!(this.cfg.apiKey && this.cfg.merchantId); }

  async getStatus(): Promise<TerminalStatus> {
    if (!this.isConfigured()) return "offline";
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.stcbank.com.sa"}/v1/health`, {
        headers: { "Authorization": `Bearer ${this.cfg.apiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      return resp.ok ? "online" : "error";
    } catch {
      return "offline";
    }
  }

  async pay(req: PayRequest): Promise<PayResponse> {
    if (!this.isConfigured()) return { success: false, error: "STC Bank غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.stcbank.com.sa"}/v1/payment/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          merchantId: this.cfg.merchantId,
          amount: req.amount,
          currency: req.currency || "SAR",
          referenceId: req.orderId || makeId("stc"),
          description: req.description || "CLUNY CAFE",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      return {
        success: resp.ok && (data.status === "success" || data.responseCode === "0000"),
        transactionId: data.transactionId || data.paymentId,
        authCode: data.authCode,
        cardBrand: "STC Bank",
        receiptData: data,
        error: resp.ok ? undefined : data.message || "STC Bank error",
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    if (!this.isConfigured()) return { success: false, error: "STC Bank غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.stcbank.com.sa"}/v1/payment/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({ transactionId: req.transactionId, amount: req.amount }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await resp.json();
      return { success: resp.ok, refundId: data.refundId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async cancel(): Promise<void> {}
}

// ─── Driver: Foodics Pay ──────────────────────────────────────────────────────

interface FoodicsPayConfig {
  apiKey: string;
  businessId: string;
  baseUrl?: string;
}

class FoodicsPayDriver implements TerminalDriver {
  id: DriverId = "foodicspay";
  nameAr = "Foodics Pay";
  nameEn = "Foodics Pay";
  features = ["card", "refund", "tip", "split"];
  private cfg: FoodicsPayConfig;

  constructor(cfg: FoodicsPayConfig) { this.cfg = cfg; }

  isConfigured() { return !!(this.cfg.apiKey && this.cfg.businessId); }

  async getStatus(): Promise<TerminalStatus> {
    if (!this.isConfigured()) return "offline";
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.foodics.com"}/api/v5/payment/terminals`, {
        headers: { "Authorization": `Bearer ${this.cfg.apiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      return resp.ok ? "online" : "error";
    } catch {
      return "offline";
    }
  }

  async pay(req: PayRequest): Promise<PayResponse> {
    if (!this.isConfigured()) return { success: false, error: "Foodics Pay غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.foodics.com"}/api/v5/payment/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          business_reference: this.cfg.businessId,
          amount: req.amount,
          currency: req.currency || "SAR",
          reference: req.orderId || makeId("fdc"),
          description: req.description || "CLUNY CAFE",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      return {
        success: resp.ok && data.status === "succeeded",
        transactionId: data.id || data.transaction_id,
        authCode: data.authorization_code,
        cardBrand: data.payment_method?.brand,
        last4: data.payment_method?.last4,
        receiptData: data,
        error: resp.ok ? undefined : data.message,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    if (!this.isConfigured()) return { success: false, error: "Foodics Pay غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.foodics.com"}/api/v5/payment/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({ transaction_id: req.transactionId, amount: req.amount }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await resp.json();
      return { success: resp.ok, refundId: data.id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async cancel(): Promise<void> {}
}

// ─── Driver: Al Rajhi Bank ────────────────────────────────────────────────────

interface RajhiConfig {
  merchantId: string;
  terminalId: string;
  secretKey: string;
  baseUrl?: string;
}

class RajhiDriver implements TerminalDriver {
  id: DriverId = "rajhi";
  nameAr = "مصرف الراجحي";
  nameEn = "Al Rajhi Bank";
  features = ["card", "mada", "contactless", "refund"];
  private cfg: RajhiConfig;

  constructor(cfg: RajhiConfig) { this.cfg = cfg; }

  isConfigured() { return !!(this.cfg.merchantId && this.cfg.terminalId && this.cfg.secretKey); }

  async getStatus(): Promise<TerminalStatus> {
    if (!this.isConfigured()) return "offline";
    return "unknown";
  }

  async pay(req: PayRequest): Promise<PayResponse> {
    if (!this.isConfigured()) return { success: false, error: "الراجحي غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://ecommerce.alrajhibank.com.sa"}/api/v1/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MerchantId": this.cfg.merchantId,
          "TerminalId": this.cfg.terminalId,
          "Authorization": `Bearer ${this.cfg.secretKey}`,
        },
        body: JSON.stringify({
          Amount: req.amount * 100,
          CurrencyCode: "682",
          MerchantReference: req.orderId || makeId("raj"),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      return {
        success: resp.ok && (data.ResponseCode === "00" || data.Approved),
        transactionId: data.TransactionId,
        authCode: data.AuthCode,
        cardBrand: data.CardScheme,
        last4: data.MaskedPAN?.slice(-4),
        receiptData: data,
        error: resp.ok ? undefined : data.ResponseMessage,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    if (!this.isConfigured()) return { success: false, error: "الراجحي غير مُهيّأ" };
    return { success: false, error: "استرداد الراجحي يتم عبر الجهاز المادي" };
  }

  async cancel(): Promise<void> {}
}

// ─── Driver: Al Ahli Bank ─────────────────────────────────────────────────────

interface AhliConfig {
  merchantId: string;
  apiKey: string;
  baseUrl?: string;
}

class AhliDriver implements TerminalDriver {
  id: DriverId = "ahli";
  nameAr = "البنك الأهلي";
  nameEn = "Al Ahli Bank (NCB)";
  features = ["card", "mada", "apple_pay", "refund"];
  private cfg: AhliConfig;

  constructor(cfg: AhliConfig) { this.cfg = cfg; }

  isConfigured() { return !!(this.cfg.merchantId && this.cfg.apiKey); }

  async getStatus(): Promise<TerminalStatus> {
    if (!this.isConfigured()) return "offline";
    return "unknown";
  }

  async pay(req: PayRequest): Promise<PayResponse> {
    if (!this.isConfigured()) return { success: false, error: "البنك الأهلي غير مُهيّأ" };
    try {
      const resp = await fetch(`${this.cfg.baseUrl || "https://api.alahli.com"}/payment/v1/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.cfg.apiKey,
          "merchant-id": this.cfg.merchantId,
        },
        body: JSON.stringify({
          amount: req.amount,
          currency: "SAR",
          orderId: req.orderId || makeId("ahli"),
          description: req.description || "CLUNY CAFE",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await resp.json();
      return {
        success: resp.ok && data.responseCode === "000",
        transactionId: data.transactionId,
        authCode: data.authCode,
        cardBrand: data.cardBrand,
        last4: data.maskedPan?.slice(-4),
        receiptData: data,
        error: resp.ok ? undefined : data.responseMessage,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    if (!this.isConfigured()) return { success: false, error: "البنك الأهلي غير مُهيّأ" };
    return { success: false, error: "استرداد الأهلي يتم عبر الجهاز المادي" };
  }

  async cancel(): Promise<void> {}
}

// ─── Payment Terminal Service (Singleton) ─────────────────────────────────────

interface TerminalConfig {
  activeDriverId: DriverId;
  drivers: Partial<Record<DriverId, any>>;
}

class PaymentTerminalService extends EventEmitter {
  private drivers: Map<DriverId, TerminalDriver> = new Map();
  private activeDriverId: DriverId = "manual";
  private transactions: Map<string, TerminalTransaction> = new Map();
  private config: TerminalConfig = { activeDriverId: "manual", drivers: {} };

  constructor() {
    super();
    this.drivers.set("manual", new ManualDriver());
    this.loadConfig();
  }

  private loadConfig() {
    const envGeidea = process.env.GEIDEA_MERCHANT_ID;
    if (envGeidea) {
      this.drivers.set("geidea", new GeideaDriver({
        merchantId: process.env.GEIDEA_MERCHANT_ID!,
        apiPassword: process.env.GEIDEA_API_PASSWORD || "",
        publicKey: process.env.GEIDEA_PUBLIC_KEY || "",
        baseUrl: process.env.GEIDEA_BASE_URL,
      }));
    }
    const envSTC = process.env.STCPAY_API_KEY;
    if (envSTC) {
      this.drivers.set("stcbank", new STCBankDriver({
        apiKey: process.env.STCPAY_API_KEY!,
        merchantId: process.env.STCPAY_MERCHANT_ID || "",
        baseUrl: process.env.STCBANK_BASE_URL,
      }));
    }
  }

  configure(cfg: TerminalConfig) {
    this.config = cfg;
    this.activeDriverId = cfg.activeDriverId || "manual";

    if (cfg.drivers?.geidea?.merchantId) {
      this.drivers.set("geidea", new GeideaDriver(cfg.drivers.geidea));
    }
    if (cfg.drivers?.mada?.terminalIp) {
      this.drivers.set("mada", new MadaDriver(cfg.drivers.mada));
    }
    if (cfg.drivers?.stcbank?.apiKey) {
      this.drivers.set("stcbank", new STCBankDriver(cfg.drivers.stcbank));
    }
    if (cfg.drivers?.foodicspay?.apiKey) {
      this.drivers.set("foodicspay", new FoodicsPayDriver(cfg.drivers.foodicspay));
    }
    if (cfg.drivers?.rajhi?.merchantId) {
      this.drivers.set("rajhi", new RajhiDriver(cfg.drivers.rajhi));
    }
    if (cfg.drivers?.ahli?.merchantId) {
      this.drivers.set("ahli", new AhliDriver(cfg.drivers.ahli));
    }
    this.emit("config_changed", { activeDriverId: this.activeDriverId });
  }

  setActiveDriver(driverId: DriverId) {
    if (!this.drivers.has(driverId)) throw new Error(`Driver '${driverId}' not registered`);
    this.activeDriverId = driverId;
    this.emit("driver_changed", { driverId });
  }

  getActiveDriver(): TerminalDriver {
    return this.drivers.get(this.activeDriverId) || this.drivers.get("manual")!;
  }

  getAllDrivers(): TerminalDriver[] {
    return Array.from(this.drivers.values());
  }

  async getTerminalInfos(): Promise<TerminalInfo[]> {
    const allDrivers: TerminalDriver[] = [
      this.drivers.get("manual")!,
      new GeideaDriver({ merchantId: this.config.drivers?.geidea?.merchantId || "", apiPassword: this.config.drivers?.geidea?.apiPassword || "", publicKey: "" }),
      new MadaDriver({ terminalIp: this.config.drivers?.mada?.terminalIp || "" }),
      new STCBankDriver({ apiKey: this.config.drivers?.stcbank?.apiKey || "", merchantId: this.config.drivers?.stcbank?.merchantId || "" }),
      new FoodicsPayDriver({ apiKey: this.config.drivers?.foodicspay?.apiKey || "", businessId: this.config.drivers?.foodicspay?.businessId || "" }),
      new RajhiDriver({ merchantId: this.config.drivers?.rajhi?.merchantId || "", terminalId: this.config.drivers?.rajhi?.terminalId || "", secretKey: this.config.drivers?.rajhi?.secretKey || "" }),
      new AhliDriver({ merchantId: this.config.drivers?.ahli?.merchantId || "", apiKey: this.config.drivers?.ahli?.apiKey || "" }),
    ];

    const registered = new Set(this.drivers.keys());
    return Promise.all(allDrivers.map(async (d) => {
      const configured = registered.has(d.id) ? d.isConfigured() : false;
      const status: TerminalStatus = configured ? await this.drivers.get(d.id)!.getStatus().catch(() => "error" as TerminalStatus) : "offline";
      return {
        id: d.id,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        status,
        lastChecked: new Date(),
        configured,
        features: d.features,
        active: d.id === this.activeDriverId,
      } as any;
    }));
  }

  async pay(req: PayRequest): Promise<{ txn: TerminalTransaction; response: PayResponse }> {
    const driver = this.getActiveDriver();
    const txnId = makeId("txn");
    const txn: TerminalTransaction = {
      id: txnId,
      driverId: driver.id,
      orderId: req.orderId,
      amount: req.amount,
      currency: req.currency || "SAR",
      status: "pending",
      createdAt: new Date(),
      cashierId: req.cashierId,
      branchId: req.branchId,
    };
    this.transactions.set(txnId, txn);
    this.emit("payment_started", { txnId, driverId: driver.id, amount: req.amount });

    const response = await driver.pay(req).catch((err): { success: false; error: string } => ({ success: false as const, error: String(err.message) }));

    txn.status = response.success ? "success" : "failed";
    if (response.success) {
      txn.transactionId = response.transactionId;
      txn.authCode = response.authCode;
      txn.cardBrand = response.cardBrand;
      txn.last4 = response.last4;
    }
    txn.error = (response as any).error;
    txn.completedAt = new Date();

    this.emit("payment_completed", { txnId, success: response.success, driverId: driver.id });
    return { txn, response };
  }

  async refund(req: RefundRequest, driverId?: DriverId): Promise<RefundResponse> {
    const driver = driverId ? this.drivers.get(driverId) || this.getActiveDriver() : this.getActiveDriver();
    return driver.refund(req).catch((err) => ({ success: false, error: err.message }));
  }

  async cancel(transactionId?: string) {
    const driver = this.getActiveDriver();
    await driver.cancel(transactionId).catch(() => {});
    if (transactionId) {
      const txn = [...this.transactions.values()].find((t) => t.transactionId === transactionId);
      if (txn) txn.status = "cancelled";
    }
    this.emit("payment_cancelled", { transactionId });
  }

  getTransactions(limit = 50): TerminalTransaction[] {
    return [...this.transactions.values()].slice(-limit).reverse();
  }

  getActiveDriverId() { return this.activeDriverId; }
  getConfig() { return this.config; }
}

export const paymentTerminalService = new PaymentTerminalService();
