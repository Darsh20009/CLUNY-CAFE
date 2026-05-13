import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { initWebPush } from "./push-service";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ ERROR: MONGODB_URI environment variable is not set");
  process.exit(1);
}

// Auto-configure Geidea payment gateway (called after DB is ready)
async function autoConfigureGeidea() {
  const { BusinessConfigModel } = await import("./models");
  const GEIDEA_PUBLIC_KEY = process.env.GEIDEA_PUBLIC_KEY || '5bf49a11-693b-4d3c-9d85-4f757d03cc1c';
  const GEIDEA_API_PASSWORD = process.env.GEIDEA_API_PASSWORD || 'c37321b2-9785-4439-8e53-61005f13fab3';
  const GEIDEA_BASE_URL = process.env.GEIDEA_BASE_URL || 'https://api.ksamerchant.geidea.net';

  const config = await BusinessConfigModel.findOne({ tenantId: 'demo-tenant' });
  if (!config) return;

  const pg = config.paymentGateway;
  const APPLE_MERCHANT_ID = process.env.APPLE_PAY_MERCHANT_ID || 'merchant.cluny.cafe';
  const needsUpdate = pg?.provider !== 'geidea' ||
    pg?.geidea?.publicKey !== GEIDEA_PUBLIC_KEY ||
    pg?.geidea?.apiPassword !== GEIDEA_API_PASSWORD ||
    pg?.geidea?.baseUrl !== GEIDEA_BASE_URL ||
    (pg?.geidea as any)?.applePayMerchantId !== APPLE_MERCHANT_ID ||
    pg?.cashEnabled !== false ||
    pg?.paymentTestMode !== false;

  if (needsUpdate) {
    await BusinessConfigModel.updateOne(
      { tenantId: 'demo-tenant' },
      {
        $set: {
          'paymentGateway.provider': 'geidea',
          'paymentGateway.geidea.publicKey': GEIDEA_PUBLIC_KEY,
          'paymentGateway.geidea.apiPassword': GEIDEA_API_PASSWORD,
          'paymentGateway.geidea.baseUrl': GEIDEA_BASE_URL,
          'paymentGateway.geidea.applePayMerchantId': process.env.APPLE_PAY_MERCHANT_ID || 'merchant.cluny.cafe',
          'paymentGateway.cashEnabled': false,
          'paymentGateway.qahwaCardEnabled': true,
          'paymentGateway.paymentTestMode': false,
        }
      }
    );
    console.log('✅ Geidea payment gateway configured automatically');
  } else {
    console.log('✅ Geidea payment gateway already configured');
  }
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
  };

  try {
    console.log(`🔌 Attempting MongoDB connection (Attempt ${connectionRetries + 1})...`);
    await mongoose.connect(MONGODB_URI!, options);
    isDbConnected = true;
    connectionRetries = 0;
    console.log("✅ MongoDB connected successfully");
    // Drop old unique index on orderNumber (allows wrap-around counter at 1000)
    try {
      const { OrderModel } = await import("@shared/schema");
      await OrderModel.collection.dropIndex("orderNumber_1").catch(() => {});
      console.log("✅ Order number uniqueness migrated to allow counter wrap-around");
    } catch (_) {}
    // Auto-configure Geidea after DB is ready (avoids buffering timeout)
    autoConfigureGeidea().catch(err => console.error('❌ Failed to auto-configure Geidea:', err));
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
  console.log('📡 MongoDB disconnected. Attempting to reconnect...');
  isDbConnected = false;
  connectDatabase();
});

mongoose.connection.on('error', (err) => {
  console.error('📡 MongoDB error:', err);
  isDbConnected = false;
});

// Start database connection in background
connectDatabase();

// Initialize Web Push
initWebPush();

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

// ─── SECURITY LAYER ────────────────────────────────────────────────────────────

// 1. Helmet: Sets 14 security HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
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
          "https://*.ksamerchant.geidea.net",
          "https://www.ksamerchant.geidea.net",
          "https://js.ksamerchant.geidea.net",
          "blob:",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.geidea.net", "https://*.ksamerchant.geidea.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://*.geidea.net", "https://*.ksamerchant.geidea.net"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          "https:",
          "https://*.geidea.net",
          "https://*.ksamerchant.geidea.net",
          "https://*.replit.dev",
          "https://*.kirk.replit.dev",
        ],
        frameSrc: ["'self'", "https://*.geidea.net", "https://*.ksamerchant.geidea.net"],
        frameAncestors: ["'self'"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        scriptSrcAttr: ["'unsafe-inline'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

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
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  skip: (req) => process.env.NODE_ENV === "development",
});

app.use("/api/employees/login", authLimiter);
app.use("/api/customers/login", authLimiter);
app.use("/api/customers/register", authLimiter);
app.use("/api", apiLimiter);

// 3. Enable gzip compression
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// 4. NoSQL Injection protection (strips $ and . from request body/query/params)
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[SECURITY] Sanitized suspicious key "${key}" from ${req.ip}`);
  },
}));

// 5. HTTP Parameter Pollution protection
app.use(hpp());

// Trust proxy - required for Render, Replit, and other reverse proxy services
app.set('trust proxy', 1);

// Configure allowed hosts for Replit and Render
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
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: isDbConnected ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState
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

// Serve the locally cached Geidea checkout SDK
app.get('/geideaCheckout.min.js', (req, res) => {
  const sdkPath = path.resolve(__dirname, '..', 'public', 'geideaCheckout.min.js');
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(sdkPath, (err) => {
    if (err) res.status(404).send('// SDK not found');
  });
});

// Serve Apple Pay domain association file (required for Apple Pay on web)
// Must be registered early, before SPA catch-all, with text/plain MIME type
const applePayFilePath = path.resolve(__dirname, '..', 'public', '.well-known', 'apple-developer-merchantid-domain-association');

app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(applePayFilePath, (err) => {
    if (err) res.status(404).send('File not found');
  });
});

app.get('/.well-known/apple-developer-merchantid-domain-association.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(applePayFilePath, (err) => {
    if (err) res.status(404).send('File not found');
  });
});

// Serve attached assets for both development and production
app.use('/attached_assets', express.static(path.resolve(__dirname, '..', 'attached_assets'), {
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'public, max-age=3600');
    // Ensure correct content type for images
    if (filePath.endsWith('.png')) res.set('Content-Type', 'image/png');
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.set('Content-Type', 'image/jpeg');
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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Error:", err);
    res.status(status).json({ message });
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
