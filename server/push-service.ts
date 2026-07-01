import webpush from "web-push";
import mongoose from "mongoose";
import https from "https";
import crypto from "crypto";

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String },
    auth: { type: String },
  },
  userType: { type: String, enum: ["employee", "customer"] },
  userId: { type: String },
  branchId: { type: String },
  tenantId: { type: String, default: "demo-tenant" },
  createdAt: { type: Date, default: Date.now },
});

export const PushSubscriptionModel =
  mongoose.models.PushSubscription ||
  mongoose.model("PushSubscription", pushSubscriptionSchema);

export function initWebPush() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || "mailto:cafe@cluny.cafe";

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[PUSH] VAPID keys not configured. Web Push notifications disabled.");
    return;
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    console.log("✅ Web Push initialized with VAPID keys");
  } catch (err) {
    console.warn("[PUSH] Invalid VAPID keys — Web Push notifications disabled.", err instanceof Error ? err.message : err);
  }
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function saveSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userType: string,
  userId: string,
  branchId?: string,
  tenantId?: string
) {
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userType,
      userId,
      branchId,
      tenantId: tenantId || "demo-tenant",
      createdAt: new Date(),
    },
    { upsert: true, new: true }
  );
}

export async function removeSubscription(endpoint: string) {
  await PushSubscriptionModel.deleteOne({ endpoint });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: 'order_status' | 'new_order' | 'general' | 'promo';
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  status?: string;
  totalAmount?: number;
  itemCount?: number;
  items?: Array<{ name: string; quantity: number }>;
  customerName?: string;
  orderType?: string;
  estimatedTime?: number;
  branchName?: string;
  image?: string;
  actions?: Array<{ action: string; title: string }>;
  stageIndex?: number;
  totalStages?: number;
  data?: Record<string, any>;
}

/** Convert any Base64 variant to URL-safe Base64 (no padding) as required by web-push */
function toUrlSafeBase64(str: string): string {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sendPushToSubscriptions(
  subscriptions: any[],
  payload: PushPayload
) {
  if (subscriptions.length === 0) return;

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "notification",
    type: payload.type || "general",
    orderNumber: payload.orderNumber,
    orderStatus: payload.orderStatus,
    totalAmount: payload.totalAmount,
    itemCount: payload.itemCount,
    items: payload.items,
    customerName: payload.customerName,
    orderType: payload.orderType,
    estimatedTime: payload.estimatedTime,
    branchName: payload.branchName,
    image: payload.image,
    actions: payload.actions,
    stageIndex: payload.stageIndex,
    totalStages: payload.totalStages,
    timestamp: Date.now(),
  });

  const isNewOrder = payload.type === 'new_order';
  const pushOptions: webpush.RequestOptions = {
    TTL: 86400,
    urgency: isNewOrder ? 'high' : 'normal',
    topic: payload.tag || payload.type || 'notification',
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) => {
      const normalizedKeys = sub.keys ? {
        p256dh: toUrlSafeBase64(sub.keys.p256dh || ''),
        auth:   toUrlSafeBase64(sub.keys.auth   || ''),
      } : sub.keys;
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: normalizedKeys },
        pushPayload,
        pushOptions
      );
    })
  );

  const staleEndpoints: string[] = [];
  let successCount = 0;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const statusCode = (result.reason as any)?.statusCode;
      console.log(`[PUSH] Failed to send to ${subscriptions[index].userId}: status=${statusCode}, error=${(result.reason as any)?.body || result.reason}`);
      if (statusCode === 410 || statusCode === 404 || statusCode === 401) {
        staleEndpoints.push(subscriptions[index].endpoint);
      }
    } else {
      successCount++;
    }
  });
  console.log(`[PUSH] Sent ${successCount}/${subscriptions.length} notifications successfully`);

  if (staleEndpoints.length > 0) {
    await PushSubscriptionModel.deleteMany({
      endpoint: { $in: staleEndpoints },
    });
    console.log(`[PUSH] Removed ${staleEndpoints.length} stale subscriptions`);
  }
}

export async function sendPushToEmployee(branchId: string, payload: PushPayload) {
  const query: any = { userType: "employee" };
  if (branchId && branchId !== "all") {
    query.branchId = branchId;
  }
  const subscriptions = await PushSubscriptionModel.find(query);
  console.log(`[PUSH] sendPushToEmployee: branch=${branchId}, found ${subscriptions.length} subscriptions`);
  if (subscriptions.length === 0) {
    const allEmpSubs = await PushSubscriptionModel.find({ userType: "employee" });
    console.log(`[PUSH] Total employee subscriptions in DB: ${allEmpSubs.length}`, allEmpSubs.map(s => ({ userId: s.userId, branchId: s.branchId })));
    if (allEmpSubs.length > 0 && branchId && branchId !== "all") {
      console.log(`[PUSH] Falling back to all employee subscriptions since branch ${branchId} had none`);
      await sendPushToSubscriptions(allEmpSubs, payload);
      return;
    }
  }
  await sendPushToSubscriptions(subscriptions, payload);
}

export async function sendPushToCustomer(customerId: string, payload: PushPayload, fallbackPhone?: string) {
  let subscriptions = await PushSubscriptionModel.find({
    userType: "customer",
    userId: customerId,
  });
  console.log(`[PUSH] sendPushToCustomer: customerId=${customerId}, found ${subscriptions.length} subscriptions`);

  // Fallback: if no subscription found by ID, try phone number variants
  if (subscriptions.length === 0 && fallbackPhone) {
    const cleanPhone = fallbackPhone.replace(/\D/g, '').replace(/^966/, '0').replace(/^9665/, '05');
    const variants = [cleanPhone, fallbackPhone, cleanPhone.replace(/^0/, '966'), cleanPhone.replace(/^0/, '+966')];
    subscriptions = await PushSubscriptionModel.find({
      userType: "customer",
      userId: { $in: variants },
    });
    if (subscriptions.length > 0) {
      console.log(`[PUSH] Found ${subscriptions.length} subscriptions via phone fallback for ${cleanPhone}`);
    }
  }

  await sendPushToSubscriptions(subscriptions, payload);
}

export async function sendPushToAll(tenantId: string, payload: PushPayload) {
  const subscriptions = await PushSubscriptionModel.find({
    tenantId: tenantId || "demo-tenant",
  });
  await sendPushToSubscriptions(subscriptions, payload);
}

export async function sendPushBySubscriptions(subscriptions: any[], payload: PushPayload) {
  await sendPushToSubscriptions(subscriptions, payload);
}

// ─── APNs (Apple Push Notifications Service) ─────────────────────────────────

const apnsDeviceTokenSchema = new mongoose.Schema({
  token:      { type: String, required: true, unique: true },
  platform:   { type: String, default: "ios" },
  phone:      { type: String },
  employeeId: { type: String },
  tenantId:   { type: String, default: "demo-tenant" },
  createdAt:  { type: Date, default: Date.now },
});

export const APNsDeviceTokenModel =
  mongoose.models.APNsDeviceToken ||
  mongoose.model("APNsDeviceToken", apnsDeviceTokenSchema);

export async function saveAPNsToken(
  token: string, phone: string, employeeId: string, tenantId: string
) {
  await APNsDeviceTokenModel.findOneAndUpdate(
    { token },
    { token, phone, employeeId, tenantId: tenantId || "demo-tenant", createdAt: new Date() },
    { upsert: true }
  );
}

export async function removeAPNsToken(token: string) {
  await APNsDeviceTokenModel.deleteOne({ token });
}

/**
 * Build an ES256 JWT for APNs provider auth (uses .p8 key from env).
 */
function buildAPNsJWT(): string | null {
  const keyId   = process.env.APNS_KEY_ID;
  const teamId  = process.env.APNS_TEAM_ID;
  const p8      = (process.env.APNS_P8_KEY || "").replace(/\\n/g, "\n");
  if (!keyId || !teamId || !p8) return null;

  const header  = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const data    = `${header}.${payload}`;
  const sign    = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  const sig = sign.sign({ key: p8, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${data}.${sig}`;
}

/**
 * Send an APNs push notification to a single device token.
 */
async function sendAPNsToToken(
  token: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const jwt = buildAPNsJWT();
  if (!jwt) return;
  const bundleId = process.env.APNS_BUNDLE_ID || "cluny.cafe";

  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
      "content-available": 1,
    },
    ...data,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.push.apple.com",
        port: 443,
        path: `/3/device/${token}`,
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": bundleId,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            console.warn(`[APNs] Delivery failed ${res.statusCode} for token ${token.slice(0, 12)}:`, body);
            if (res.statusCode === 410 || res.statusCode === 400) {
              APNsDeviceTokenModel.deleteOne({ token }).catch(() => {});
            }
          });
        }
        resolve();
      }
    );
    req.on("error", (e) => { console.warn("[APNs] Request error:", e.message); resolve(); });
    req.write(payload);
    req.end();
  });
}

/**
 * Send an APNs push notification to a customer by phone number.
 */
export async function sendAPNsToCustomer(
  phone: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const cleanPhone = phone.replace(/\D/g, "").replace(/^966/, "0").replace(/^9665/, "05");
  const variants = [cleanPhone, phone, cleanPhone.replace(/^0/, "966"), cleanPhone.replace(/^0/, "+966")];
  const tokens = await APNsDeviceTokenModel.find({ phone: { $in: variants } });
  await Promise.allSettled(tokens.map((t) => sendAPNsToToken(t.token, title, body, data)));
}

/**
 * Send an APNs push notification to all employee tokens.
 */
export async function sendAPNsToEmployees(
  tenantId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const tokens = await APNsDeviceTokenModel.find({ tenantId, employeeId: { $ne: "" } });
  await Promise.allSettled(tokens.map((t) => sendAPNsToToken(t.token, title, body, data)));
}
