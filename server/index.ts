// Polyfill Web Crypto API for MongoDB driver compatibility (must be first)
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import compression from "compression";
import path from "path";
import { cache } from "./cache";
import { queue } from "./queue";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { registerQiroxRoutes } from "./qirox-admin";
import { storage } from "./storage";
import { initWebPush } from "./push-service";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import {
  initSecondaryConnection,
  getDbStatus,
  hasSecondaryDb,
  isUsingSecondaryDb,
  getIsControlledSwitch,
} from "./db-manager";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ ERROR: MONGODB_URI environment variable is not set");
  process.exit(1);
}

// Track database connection status
let isDbConnected = false;
let isInitializing = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;

// Connect to MongoDB with robust error handling and retries
async function connectDatabase() {
  if (isInitializing) return;
  isInitializing = true;
  
  const options = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000,
    maxPoolSize: 200,
    minPoolSize: 20,
    waitQueueTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxIdleTimeMS: 60000,
    compressors: ['zlib'] as any,
  };

  try {
    console.log(`🔌 Attempting MongoDB connection (Attempt ${connectionRetries + 1})...`);
    await mongoose.connect(MONGODB_URI!, options);
    isDbConnected = true;
    connectionRetries = 0;
    console.log("✅ MongoDB connected successfully");
    // Connect secondary DB in background (non-blocking)
    initSecondaryConnection().catch(() => {});
    // Drop old unique index on orderNumber (allows wrap-around counter at 1000)
    try {
      const { OrderModel } = await import("@shared/schema");
      await OrderModel.collection.dropIndex("orderNumber_1").catch(() => {});
      console.log("✅ Order number uniqueness migrated to allow counter wrap-around");
    } catch (_) {}
    // ── Connection warming: pre-fetch common collections to populate Atlas pool ──
    // Without this, the first requests after restart hit a 3–6 s cold-start penalty.
    setImmediate(async () => {
      try {
        const {
          CoffeeItemModel, MenuCategoryModel, ProductAddonModel,
          BusinessConfigModel,
        } = await import("@shared/schema");
        await Promise.all([
          CoffeeItemModel.findOne({}).lean(),
          MenuCategoryModel.findOne({}).lean(),
          ProductAddonModel.findOne({}).lean(),
          BusinessConfigModel.findOne({}).lean(),
        ]);
        console.log("✅ DB connection pool warmed — first requests will be fast");
      } catch (_) {
        // warming is best-effort, never block startup
      }
    });
    // ── One-time migration: set tenantId on tables that don't have one ──
    try {
      const { TableModel } = await import("@shared/schema");
      const tableMigration = await TableModel.updateMany(
        { $or: [{ tenantId: { $exists: false } }, { tenantId: null }, { tenantId: "" }] },
        { $set: { tenantId: 'demo-tenant' } }
      );
      if (tableMigration.modifiedCount > 0) {
        console.log(`✅ Migration: Fixed tenantId on ${tableMigration.modifiedCount} tables`);
      } else {
        console.log("✅ All tables already have tenantId set");
      }
    } catch (err) {
      console.error("Table tenantId migration error:", err);
    }
    // ── One-time migration: publish all products to all branches ──
    // Ensures every product is visible in every branch by setting publishedBranches: ['*']
    try {
      const { CoffeeItemModel } = await import("@shared/schema");
      const migrationResult = await CoffeeItemModel.updateMany(
        { $or: [{ publishedBranches: { $exists: false } }, { publishedBranches: { $size: 0 } }, { publishedBranches: { $not: { $elemMatch: { $eq: '*' } } } }] },
        [{ $set: { publishedBranches: ['*'] } }]
      );
      if (migrationResult.modifiedCount > 0) {
        console.log(`✅ Migration: Published ${migrationResult.modifiedCount} products to all branches`);
      } else {
        console.log("✅ All products already published to all branches");
      }
    } catch (err) {
      console.error("Product branch migration error:", err);
    }
    // Ensure admin/owner accounts exist and use the portal password
    try {
      const bcrypt = await import("bcryptjs");
      const { v4: uuidv4 } = await import("uuid");
      const { EmployeeModel } = await import("@shared/schema");
      const ownerPass = process.env.PORTAL_DEFAULT_PASSWORD || "123456";
      const adminPass = process.env.ADMIN_DEFAULT_PASSWORD || "123456";
      const ownerPasswordHash = await bcrypt.hash(ownerPass, 10);
      const adminPasswordHash = await bcrypt.hash(adminPass, 10);

      // Sync admin password
      const adminResult = await EmployeeModel.updateOne(
        { username: "admin" },
        { $set: { password: adminPasswordHash, isActivated: 1, isActive: 1 } }
      );
      if (adminResult.matchedCount > 0) {
        console.log(`✅ Portal account 'admin' password synced`);
      }

      // Create or sync owner account
      const ownerExists = await EmployeeModel.findOne({ username: "owner" });
      if (!ownerExists) {
        await EmployeeModel.create({
          id: uuidv4(),
          tenantId: "demo-tenant",
          username: "owner",
          password: ownerPasswordHash,
          fullName: "المالك",
          role: "owner",
          phone: "0000000001",
          jobTitle: "المالك",
          isActivated: 1,
          isActive: 1,
        });
        console.log(`✅ Owner account created`);
      } else {
        await EmployeeModel.updateOne({ username: "owner" }, { $set: { password: ownerPasswordHash, isActivated: 1, isActive: 1 } });
        console.log(`✅ Portal account 'owner' password synced`);
      }
    } catch (err) { console.error("Owner sync error:", err); }
    // Ensure demo-tenant has Infinity plan — all features unlocked
    try {
      const { SubscriptionConfigModel } = await import("./qirox-admin");
      await SubscriptionConfigModel.findOneAndUpdate(
        { tenantId: 'demo-tenant' },
        {
          $set: {
            plan: 'infinity',
            isActive: true,
            maxBranches: 999,
            maxEmployees: 9999,
            maxProducts: 9999,
            maxOrders: 999999,
            customBranding: true,
            apiAccess: true,
            advancedAnalytics: true,
            multiLanguage: true,
            inventoryManagement: true,
            recipeManagement: true,
            accountingModule: true,
            erpIntegration: true,
            deliveryManagement: true,
            loyaltyProgram: true,
            giftCards: true,
            tableManagement: true,
            kitchenDisplay: true,
            customerApp: true,
            posSystem: true,
            payrollManagement: true,
            supplierManagement: true,
            warehouseManagement: true,
            zatcaCompliance: true,
            supportPriority: 'dedicated',
            activatedBy: 'system',
            updatedAt: new Date(),
          }
        },
        { upsert: true, new: true }
      );
      console.log("✅ Subscription: Infinity plan — all features unlocked");
    } catch (_) {}
    // Seed promotional discount code BRCAFE10 (10% off, shareable promo link)
    // Hidden from customers by default — admin can toggle visibility from admin settings.
    try {
      const { DiscountCodeModel } = await import("@shared/schema");
      await DiscountCodeModel.findOneAndUpdate(
        { code: "BRCAFE10" },
        {
          $setOnInsert: {
            code: "BRCAFE10",
            discountPercentage: 10,
            reason: "كوبون ترويجي 10% - رابط خاص",
            employeeId: "system",
            isActive: 1,
            usageCount: 0,
            visibleToCustomers: false,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      // One-time migration: hide previously auto-visible seeded code without
      // overriding any subsequent manual change (marker prevents re-applying).
      await DiscountCodeModel.updateOne(
        { code: "BRCAFE10", _seedHiddenV1: { $exists: false } },
        { $set: { visibleToCustomers: false, _seedHiddenV1: true } }
      );
      console.log("✅ Promo code BRCAFE10 (10% off) is ready (hidden by default)");
    } catch (err) {
      console.error("BRCAFE10 seed error:", err);
    }
    // Seed discount code TECH10 — خصم 10% للمستخدم عبر نقطة البيع
    // Hidden from customers by default — admin can toggle visibility from admin settings.
    try {
      const { DiscountCodeModel } = await import("@shared/schema");
      await DiscountCodeModel.findOneAndUpdate(
        { code: "TECH10" },
        {
          $setOnInsert: {
            code: "TECH10",
            discountPercentage: 10,
            reason: "خصم خاص 10%",
            employeeId: "system",
            isActive: 1,
            usageCount: 0,
            visibleToCustomers: false,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      // One-time migration: hide previously auto-visible seeded code without
      // overriding any subsequent manual change (marker prevents re-applying).
      await DiscountCodeModel.updateOne(
        { code: "TECH10", _seedHiddenV1: { $exists: false } },
        { $set: { visibleToCustomers: false, _seedHiddenV1: true } }
      );
      console.log("✅ Discount code TECH10 (خصم خاص 10%) is ready (hidden by default)");
    } catch (err) {
      console.error("TECH10 seed error:", err);
    }
  } catch (error) {
    isDbConnected = false;
    console.error("❌ MongoDB connection error:", error);
    
    if (connectionRetries < MAX_RETRIES) {
      connectionRetries++;
      const delay = Math.min(1000 * Math.pow(2, connectionRetries), 30000);
      console.log(`🔄 Retrying in ${delay / 1000}s...`);
      setTimeout(() => {
        isInitializing = false;
        connectDatabase();
      }, delay);
    } else {
      console.error("❌ Max retries reached. Database functionality will be unavailable.");
    }
  } finally {
    isInitializing = false;
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  // Skip auto-reconnect if db-manager is performing a controlled DB switch
  if (getIsControlledSwitch()) {
    console.log('📡 MongoDB disconnected (controlled switch in progress — skipping auto-reconnect)');
    return;
  }
  console.log('📡 MongoDB disconnected. Attempting to reconnect...');
  isDbConnected = false;
  connectDatabase();
});

mongoose.connection.on('error', (err) => {
  console.error('📡 MongoDB error:', err);
  isDbConnected = false;
});

// ─── Process-level crash guards ──────────────────────────────────────────────
// Prevent the server from dying on unhandled async errors or uncaught exceptions.
// Log the error and keep running; the request that triggered it will time-out
// rather than bringing the entire process down.
process.on('unhandledRejection', (reason: any) => {
  console.error('🚨 [UNHANDLED REJECTION]', reason?.stack ?? reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('🚨 [UNCAUGHT EXCEPTION]', err.stack ?? err.message);
  // Don't call process.exit() — let the server keep serving other requests.
});
// ─────────────────────────────────────────────────────────────────────────────

// Start database connection in background
connectDatabase();

// Initialize Web Push
initWebPush();

// ── Register background job queue handlers ────────────────────────────────────
queue.register("invalidate_cache", async (job) => {
  const pattern = job.payload.pattern as string;
  if (pattern) cache.invalidate(pattern);
});

queue.register("send_notification", async (job) => {
  // Delegate to push-service — non-blocking best-effort
  try {
    const { sendPushToCustomer } = await import("./push-service");
    const { customerId, title, body, data } = job.payload;
    if (customerId) await sendPushToCustomer(customerId, { title, body, data });
  } catch (err: any) {
    console.warn("[Queue:send_notification]", err?.message);
  }
});

queue.register("deduct_inventory", async (job) => {
  // Async inventory deduction — runs after order is confirmed
  try {
    const { RawItemModel, CoffeeItemModel } = await import("@shared/schema");
    const { items, tenantId } = job.payload as { items: Array<{ coffeeItemId: string; quantity: number }>; tenantId: string };
    for (const { coffeeItemId, quantity } of items) {
      const item = await CoffeeItemModel.findOne({ id: coffeeItemId, tenantId }).lean() as any;
      if (!item?.recipe?.length) continue;
      for (const ingredient of item.recipe) {
        const deduct = (ingredient.amountPerUnit || 0) * quantity;
        if (deduct > 0) {
          await RawItemModel.findOneAndUpdate(
            { id: ingredient.rawItemId, tenantId },
            { $inc: { currentStock: -deduct, currentStockLevel: -deduct } }
          );
        }
      }
    }
    cache.invalidate(`inventory:${tenantId}`);
  } catch (err: any) {
    console.warn("[Queue:deduct_inventory]", err?.message);
  }
});

queue.register("recalc_loyalty", async (job) => {
  // Lightweight loyalty tier update
  try {
    const { CustomerModel } = await import("@shared/schema");
    const { customerId, pointsDelta } = job.payload;
    await CustomerModel.findOneAndUpdate(
      { id: customerId },
      { $inc: { totalPoints: pointsDelta, availablePoints: pointsDelta } }
    );
  } catch (err: any) {
    console.warn("[Queue:recalc_loyalty]", err?.message);
  }
});

queue.register("generate_report", async (_job) => {
  // Placeholder — future: pre-generate PDF reports and store in object storage
  console.log("[Queue:generate_report] Report generation job received (stub)");
});

console.log("✅ Background job queue initialized with 5 handlers");
// ─────────────────────────────────────────────────────────────────────────────

// Start smart notification scheduler (runs after 5s to allow DB to connect)
import("./smart-scheduler").then(({ startSmartScheduler }) => {
  setTimeout(startSmartScheduler, 5000);
}).catch((err) => console.error("[SCHEDULER] Failed to load:", err));

// Scheduled task: Clean up expired table reservations and send notifications
let isMaintenanceRunning = false;
setInterval(async () => {
  if (isMaintenanceRunning || !isDbConnected) return;
  
  isMaintenanceRunning = true;
  try {
    const { TableModel, CustomerModel } = await import("@shared/schema");
    const { sendReservationExpiryWarningEmail } = await import("./mail-service");

    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

    // 1. Check for expired reservations
    const expiredTables = await TableModel.find({
      'reservedFor.status': { $in: ['pending', 'confirmed'] },
      'reservedFor.autoExpiryTime': { $lt: now }
    });

    let expiredCount = 0;
    for (const table of expiredTables) {
      if (table.reservedFor) {
        table.reservedFor.status = 'expired';
        await table.save();
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`🔄 Cleaned ${expiredCount} expired reservations`);
    }

    // 2. Send expiry warnings (15 minutes before expiry)
    const warningTables = await TableModel.find({
      'reservedFor.status': { $in: ['pending', 'confirmed'] },
      'reservedFor.autoExpiryTime': {
        $gte: now,
        $lte: fifteenMinutesFromNow
      },
      'reservedFor.emailNotificationSent': { $ne: true }
    });

    for (const table of warningTables) {
      if (table.reservedFor && table.reservedFor.autoExpiryTime) {
        try {
          const customer = await CustomerModel.findOne({
            phone: table.reservedFor.customerPhone
          });

          if (customer && customer.email) {
            const emailSent = await sendReservationExpiryWarningEmail(
              customer.email,
              table.reservedFor.customerName,
              table.tableNumber,
              table.reservedFor.autoExpiryTime.toString()
            );

            if (emailSent) {
              table.reservedFor.emailNotificationSent = true;
              await table.save();
              console.log(`📧 Expiry warning sent to ${customer.email}`);
            }
          }
        } catch (error) {
          console.error(`Failed to send expiry warning for table ${table.tableNumber}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Maintenance task error:", error);
  } finally {
    isMaintenanceRunning = false;
  }
}, 60000); // Run every 60 seconds (1 minute)

const app = express();

// ─── Apple Pay domain verification — BEFORE all middleware ────────────────────
// Must be first so Helmet, rate-limiters, and session middleware do NOT touch
// these responses. Apple's verifier rejects files served with CSP / security
// headers or rate-limit delays.
// Serve domain-specific files: cluny.cafe / www.cluny.cafe get the cluny file,
// all other hosts (e.g. *.onrender.com) get the render file.
function appleWellKnownFile(req: import('express').Request, res: import('express').Response, ext: string) {
  const host = (req.get('host') || '').replace(/:\d+$/, '');
  const isCluny = host === 'cluny.cafe' || host === 'www.cluny.cafe';
  const filename = isCluny
    ? `apple-developer-merchantid-domain-association-cluny${ext}`
    : `apple-developer-merchantid-domain-association${ext}`;
  // Apple's verifier requires text/plain — octet-stream causes "download instead of serve" error
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400'); // 1 day cache
  res.sendFile(path.resolve(__dirname, '..', 'public', '.well-known', filename), (err) => {
    if (err) {
      console.error(`[ApplePay] Missing file: ${filename}`, err.message);
      res.status(404).send('Not found');
    }
  });
}
app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
  appleWellKnownFile(req, res, '');
});
app.get('/.well-known/apple-developer-merchantid-domain-association.txt', (req, res) => {
  appleWellKnownFile(req, res, '.txt');
});

// ─── SECURITY LAYER ────────────────────────────────────────────────────────────

// 1. Helmet: Sets 14 security HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
// Skip helmet in development to avoid CSP conflicts with Vite dev server
if (process.env.NODE_ENV === 'development') {
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: false }));
} else {
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://*.geidea.net",
          "https://*.paymob.com",
          "blob:",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.geidea.net", "https://*.paymob.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://*.geidea.net", "https://*.paymob.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          "https://*.geidea.net",
          "https://*.paymob.com",
        ],
        frameSrc: [
          "'self'",
          "https://*.geidea.net",
          "https://js.geidea.net",
          "https://*.paymob.com",
          "https://accept.paymob.com",
          "https://ksa.paymob.com",
        ],
        frameAncestors: ["'self'", "https://*.paymob.com"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
}

// 2. Rate limiting — strict for auth, relaxed for general API
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  skip: (req) => process.env.NODE_ENV === "development",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => process.env.NODE_ENV === "development",
});

app.use("/api/employees/login", authLimiter);
app.use("/api/customers/login", authLimiter);
app.use("/api/customers/register", authLimiter);
app.use("/api", apiLimiter);

// 3. Enable gzip compression (level 9 = max ratio, reduces bandwidth ~60-70% on text)
app.use(compression({
  level: 9,
  threshold: 512, // compress anything >512 bytes (not just >1KB)
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// API performance & error monitoring (Phase 5: Reliability)
import { apiMetricsMiddleware } from "./middleware/api-metrics";
app.use(apiMetricsMiddleware);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// 4. NoSQL Injection protection (strips $ and . from request body/query/params)
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Sanitized suspicious key "${key}" from ${req.ip}`);
  },
}));

// 5. HTTP Parameter Pollution protection
app.use(hpp());

// Trust proxy - required for QIROX Studio and other reverse proxy services
app.set('trust proxy', 1);

// Configure allowed hosts for QIROX Studio
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, x-employee-id, x-restore-key');
  next();
});

// 6. Disable X-Powered-By header
app.disable('x-powered-by');

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false, 
    name: 'cluny.sid', // custom cookie name
    store: MongoStore.create({
      mongoUrl: MONGODB_URI!,
      collectionName: 'sessions',
      ttl: 30 * 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 3600,
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production', 
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: "/",
    },
  })
);

// ─── Session version guard ────────────────────────────────────────────────────
// Bump this string whenever you want to force-logout every device that still
// carries an old cookie (e.g. after a major update). Old sessions are destroyed
// server-side and the cookie is cleared, so the user lands on the login screen.
const SESSION_VERSION = '2026-07-06-v1';

app.use((req, res, next) => {
  // Skip non-session paths
  if (!req.path.startsWith('/api') && !req.path.startsWith('/employee') && !req.path.startsWith('/pos')) {
    return next();
  }
  const sess = req.session as any;
  if (sess && sess.employee && sess._sv !== SESSION_VERSION) {
    // Old session — destroy it and clear the cookie
    req.session.destroy(() => {});
    res.clearCookie('cluny.sid', { path: '/' });
    return res.status(401).json({ error: 'session_expired', message: 'جلسة منتهية — يرجى تسجيل الدخول مجدداً' });
  }
  next();
});

// Session debug middleware — only active in development
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_SESSION === 'true') {
    if (req.path.startsWith('/api/orders') || req.path.startsWith('/api/employees/login')) {
      console.log(`  - Session ID:`, req.sessionID);
      console.log(`  - Employee:`, req.session?.employee ? 'EXISTS' : 'MISSING');
      console.log(`  - Cookie:`, req.headers.cookie ? 'PRESENT' : 'MISSING');
    }
  }
  next();
});

// Health check endpoint for Render and other hosting services
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/health', (_req, res) => {
  const dbStatus = getDbStatus();
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    dualDb: {
      enabled: hasSecondaryDb(),
      ...dbStatus,
    },
    cache: cache.stats(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Middleware to ensure DB connection for API routes
app.use('/api', (req, res, next) => {
  if (!isDbConnected && mongoose.connection.readyState !== 1) {
    console.error(`🚨 API Request failed: Database not connected (State: ${mongoose.connection.readyState})`);
    // Attempt to reconnect in background
    connectDatabase();
    return res.status(503).json({ 
      message: "خدمة قاعدة البيانات غير متوفرة حالياً، يرجى المحاولة مرة أخرى خلال ثوانٍ.",
      retryAfter: 5
    });
  }
  next();
});

// IMPORTANT: Ensure /api, /attached_assets, and health routes are handled BEFORE SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || 
      req.path.startsWith('/attached_assets') || 
      req.path === '/healthz' || 
      req.path === '/health') {
    return next();
  }
  next();
});


// Serve attached assets for both development and production
app.use('/attached_assets', express.static(path.resolve(__dirname, '..', 'attached_assets'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Long cache for images — browser won't re-download if ETag matches
    res.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400'); // 30 days
    if (filePath.endsWith('.png')) res.set('Content-Type', 'image/png');
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.set('Content-Type', 'image/jpeg');
    if (filePath.endsWith('.webp')) res.set('Content-Type', 'image/webp');
  }
}));

// Fallback: serve brand logo for any missing /attached_assets/ file instead of 404
app.get('/attached_assets/*', (req, res) => {
  const brandLogo = path.resolve(__dirname, '..', 'public', 'images', 'brand-logo.png');
  res.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400'); // 30 days
  res.sendFile(brandLogo, (err) => {
    if (err) res.status(404).json({ error: 'Image not found' });
  });
});

// Serve public static files (audio, images, icons) explicitly so Vite dev middleware doesn't intercept
app.use(express.static(path.resolve(__dirname, '..', 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4') || filePath.endsWith('.mp3') || filePath.endsWith('.ogg') || filePath.endsWith('.wav')) {
      res.set('Content-Type', filePath.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg');
      res.set('Cache-Control', 'public, max-age=2592000'); // 30 days
    } else if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.webp') || filePath.endsWith('.ico') || filePath.endsWith('.svg')) {
      res.set('Cache-Control', 'public, max-age=2592000, stale-while-revalidate=86400'); // 30 days
    } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      // Hashed bundles — safe to cache forever (immutable)
      res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  registerQiroxRoutes(app);
  const server = await registerRoutes(app);

  // 404 guard for unknown /api/* paths — must come BEFORE Vite SPA fallback
  // so unmatched API routes return JSON 404 instead of being swallowed by index.html
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Never expose internal stack traces in production
    if (process.env.NODE_ENV === 'production') {
      console.error(`[ERROR] ${_req.method} ${_req.path} → ${status}:`, message);
    } else {
      console.error(`[ERROR] ${_req.method} ${_req.path}:`, err);
    }

    if (!res.headersSent) {
      res.status(status).json({ message, error: process.env.NODE_ENV !== 'production' ? err?.stack : undefined });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, "0.0.0.0", async () => {
    log(`serving on port ${port}`);

    // Auto-migrate orders/shifts/employees with branchId='main' to first real branch
    try {
      const { OrderModel, BranchModel, CashierShiftModel, EmployeeModel } = await import("@shared/schema");
      const mainOrderCount = await OrderModel.countDocuments({ $or: [{ branchId: 'main' }, { branchId: null }, { branchId: { $exists: false } }] });
      if (mainOrderCount > 0) {
        const branches = await BranchModel.find({ id: { $ne: 'main' } }).sort({ createdAt: 1 }).limit(1).lean();
        if (branches.length > 0) {
          const targetBranch = branches[0] as any;
          const targetId = targetBranch.id;
          const ordersResult = await OrderModel.updateMany(
            { $or: [{ branchId: 'main' }, { branchId: null }, { branchId: { $exists: false } }] },
            { $set: { branchId: targetId } }
          );
          await CashierShiftModel.updateMany(
            { $or: [{ branchId: 'main' }, { branchId: null }] },
            { $set: { branchId: targetId, branchName: targetBranch.nameAr || '' } }
          );
          await EmployeeModel.updateMany(
            { branchId: 'main' },
            { $set: { branchId: targetId } }
          );
          await BranchModel.findOneAndDelete({ $or: [{ id: 'main' }, { nameEn: /^main$/i }] });
          console.log(`✅ Auto-migrated ${ordersResult.modifiedCount} 'main' orders → branch "${targetBranch.nameAr}" (${targetId})`);
        }
      }
    } catch (err) {
      console.error('⚠️ Auto-migration of main branch skipped:', err);
    }

    // ── Ensure Geidea credentials are always set and test mode is OFF ───────────
    try {
      const { BusinessConfigModel: BCM } = await import("./models");
      const GEIDEA_PUBLIC_KEY   = process.env.GEIDEA_PUBLIC_KEY   || '5bf49a11-693b-4d3c-9d85-4f757d03cc1c';
      const GEIDEA_API_PASSWORD = process.env.GEIDEA_API_PASSWORD || 'c37321b2-9785-4439-8e53-61005f13fab3';
      const GEIDEA_BASE_URL     = process.env.GEIDEA_BASE_URL     || 'https://api.ksamerchant.geidea.net';

      await BCM.updateOne(
        { tenantId: 'demo-tenant' },
        {
          $set: {
            'paymentGateway.provider':                   'geidea',
            'paymentGateway.geidea.publicKey':           GEIDEA_PUBLIC_KEY,
            'paymentGateway.geidea.apiPassword':         GEIDEA_API_PASSWORD,
            'paymentGateway.geidea.baseUrl':             GEIDEA_BASE_URL,
            'paymentGateway.geidea.applePayMerchantId': process.env.APPLE_PAY_MERCHANT_ID || 'merchant.cluny.cafe',
            'paymentGateway.paymentTestMode':            false,
            'paymentGateway.qahwaCardEnabled':           true,
          }
        },
        { upsert: false }
      );
      console.log('✅ Geidea payment gateway configured — test mode OFF');
    } catch (err) {
      console.error('⚠️ Could not configure Geidea gateway:', err);
    }

    // Auto-configure PayMob Saudi Arabia payment gateway when credentials are provided
    try {
      const { BusinessConfigModel } = await import("./models");
      const PAYMOB_SECRET_KEY = process.env.PAYMOB_SECRET_KEY;
      const PAYMOB_PUBLIC_KEY = process.env.PAYMOB_PUBLIC_KEY;
      const PAYMOB_HMAC_SECRET = process.env.PAYMOB_HMAC_SECRET;

      if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !PAYMOB_HMAC_SECRET) {
        console.log('ℹ️ PayMob credentials not configured; skipping automatic payment gateway setup');
        return;
      }

      const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
      if (config) {
        const pg = config.paymentGateway;
        const needsUpdate = pg?.provider !== 'paymob' ||
          !pg?.paymob?.secretKey ||
          !pg?.paymob?.publicKey;

        if (needsUpdate) {
          await BusinessConfigModel.updateOne(
            { tenantId: 'demo-tenant' },
            {
              $set: {
                'paymentGateway.provider': 'paymob',
                'paymentGateway.paymob.secretKey': PAYMOB_SECRET_KEY,
                'paymentGateway.paymob.publicKey': PAYMOB_PUBLIC_KEY,
                'paymentGateway.paymob.hmacSecret': PAYMOB_HMAC_SECRET,
                'paymentGateway.paymob.baseUrl': 'https://ksa.paymob.com',
                'paymentGateway.paymob.integrationIds': [24948],
                'paymentGateway.cashEnabled': false,
                'paymentGateway.stcPayEnabled': false,
                'paymentGateway.qahwaCardEnabled': true,
              }
            }
          );
          console.log('✅ PayMob Saudi Arabia payment gateway configured automatically');
        } else {
          console.log('✅ PayMob Saudi Arabia payment gateway already configured');
        }
      }
    } catch (err) {
      console.error('❌ Failed to auto-configure PayMob:', err);
    }
    // Verify Mail Service on startup
    try {
      const { testEmailConnection } = await import("./mail-service");
      console.log("📧 Performing startup email connection test...");
      const success = await testEmailConnection();
      if (success) {
        console.log("✅ Mail service verified and ready on startup");
      } else {
        console.error("❌ Mail service failed verification on startup. Check credentials and connectivity.");
      }
    } catch (err) {
      console.error("❌ Error during mail service startup test:", err);
    }
  });
})();
