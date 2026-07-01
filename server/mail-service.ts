import nodemailer from "nodemailer";
import { appendOrderToSheet } from "./google-sheets";

let transporter: any = null;
let transporterInitialized = false;
let lastSmtpPass = "";

// Reset transporter (called after env var changes)
export function resetMailTransporter() {
  transporter = null;
  transporterInitialized = false;
  lastSmtpPass = "";
  console.log("📧 Mail transporter reset — will reinitialize on next send");
}

function loadSmtpConfig() {
  const smtpHost = process.env.SMTP_HOST || "server222.web-hosting.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER || "info@qirox.online";
  const smtpPass = process.env.SMTP_PASS || "";
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "info@qirox.online";
  return { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom };
}

async function getTransporter() {
  const { smtpPass } = loadSmtpConfig();
  // Reset if password changed (env var reload)
  if (transporterInitialized && smtpPass !== lastSmtpPass) {
    transporter = null;
    transporterInitialized = false;
  }
  if (transporterInitialized) return transporter;

  const { smtpHost, smtpPort, smtpUser, smtpFrom } = loadSmtpConfig();

  console.log(`📧 Mail service initializing — cPanel SMTP:`);
  console.log(`   Host: ${smtpHost}:${smtpPort}`);
  console.log(`   User: ${smtpUser ? "✅ " + smtpUser : "❌ not set"}`);
  console.log(`   Pass: ${smtpPass ? "✅ set" : "❌ not set"}`);
  console.log(`   From: ${smtpFrom}`);

  if (!smtpUser || !smtpPass) {
    console.warn("⚠️ SMTP credentials not configured. Emails will not be sent.");
    transporterInitialized = true;
    lastSmtpPass = smtpPass;
    return null;
  }

  try {
    const options: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,        // SSL for port 465
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    };
    if (smtpPort === 587) {
      options.requireTLS = true;
      options.secure = false;
    }
    transporter = nodemailer.createTransport(options);
    lastSmtpPass = smtpPass;
    transporterInitialized = true;
    console.log("✅ cPanel SMTP transporter created");

    transporter.verify().then(() => {
      console.log("✅ cPanel SMTP connection verified successfully");
    }).catch((err: any) => {
      console.warn("⚠️ SMTP verify failed (may still send):", err.message);
    });
  } catch (error: any) {
    console.error("❌ Error creating SMTP transporter:", error.message);
    transporterInitialized = true;
    lastSmtpPass = smtpPass;
  }

  return transporter;
}

// Central send function — cPanel SMTP only
async function sendMail(options: {
  from?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<boolean> {
  const { smtpFrom } = loadSmtpConfig();
  const from = options.from || smtpFrom;

  const transport = await getTransporter();
  if (!transport) {
    console.warn(`⚠️ [MAIL] No transport — email to ${options.to} NOT sent. Check SMTP_PASS env var.`);
    return false;
  }
  try {
    const info = await transport.sendMail({ from, ...options });
    console.log(`✅ [MAIL] Sent "${options.subject}" → ${options.to} (ID: ${info.messageId})`);
    return true;
  } catch (err: any) {
    console.error(`❌ [MAIL] Send failed → ${options.to}: ${err.message}`);
    // Reset transporter on auth errors so next attempt retries fresh
    if (err.code === "EAUTH" || err.responseCode === 535) {
      resetMailTransporter();
    }
    return false;
  }
}

export async function checkMailServiceHealth(): Promise<{ healthy: boolean; message: string; host?: string; user?: string }> {
  const { smtpHost, smtpPort, smtpUser, smtpPass } = loadSmtpConfig();
  if (!smtpUser || !smtpPass) {
    return { healthy: false, message: "SMTP_USER أو SMTP_PASS غير مضبوط", host: smtpHost };
  }
  try {
    const transport = await getTransporter();
    if (!transport) return { healthy: false, message: "فشل إنشاء الاتصال", host: smtpHost, user: smtpUser };
    await transport.verify();
    return { healthy: true, message: `الاتصال بـ ${smtpHost}:${smtpPort} ناجح ✅`, host: smtpHost, user: smtpUser };
  } catch (error: any) {
    return { healthy: false, message: `SMTP error: ${error.message}`, host: smtpHost, user: smtpUser };
  }
}

export async function sendTestEmail(toEmail: string): Promise<{ sent: boolean; message: string }> {
  const { smtpHost, smtpUser } = loadSmtpConfig();
  const sent = await sendMail({
    to: toEmail,
    subject: "✅ اختبار بريد CLUNY CAFE — cPanel SMTP",
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"></head>
      <body style="font-family:Arial,sans-serif;padding:30px;background:#f4f4f4;">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#2D9B6E,#1a7a54);padding:28px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">CLUNY CAFE ☕</h1>
          </div>
          <div style="padding:28px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">✅</div>
            <h2 style="color:#2D9B6E;margin:0 0 12px;">اختبار البريد الإلكتروني</h2>
            <p style="color:#555;font-size:14px;line-height:1.7;">
              تم ربط خادم البريد بنجاح عبر cPanel SMTP.<br/>
              الخادم: <strong>${smtpHost}</strong><br/>
              المرسل: <strong>${smtpUser}</strong>
            </p>
            <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin-top:20px;">
              <p style="color:#2D9B6E;margin:0;font-size:13px;">
                ✓ إشعارات الطلبات للعملاء تعمل<br/>
                ✓ التقارير اليومية/الأسبوعية للمدير تعمل<br/>
                ✓ بريد ترحيب الموظفين يعمل<br/>
                ✓ نسيت كلمة المرور (OTP) تعمل
              </p>
            </div>
          </div>
          <div style="background:#f8f8f8;padding:14px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} CLUNY CAFE</p>
          </div>
        </div>
      </body></html>
    `,
  });
  return {
    sent,
    message: sent
      ? `✅ تم إرسال بريد الاختبار إلى ${toEmail} بنجاح`
      : `❌ فشل الإرسال — تحقق من SMTP_PASS في متغيرات البيئة`,
  };
}

export async function sendOrderNotificationEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  orderStatus: string,
  orderTotal: number,
  originalOrder?: any
) {
  const statusAr =
    orderStatus === "completed" ? "مكتمل" :
    orderStatus === "preparing" || orderStatus === "in_progress" ? "قيد التحضير" :
    orderStatus === "ready" ? "جاهز" :
    orderStatus === "cancelled" ? "ملغي" : "قيد المعالجة";

  const statusColor =
    orderStatus === "completed" ? "#4CAF50" :
    orderStatus === "ready" ? "#2196F3" :
    orderStatus === "in_progress" || orderStatus === "preparing" ? "#FF9800" :
    orderStatus === "cancelled" ? "#f44336" : "#9C27B0";

  const message =
    orderStatus === "completed" ? "شكراً لك! طلبك جاهز للاستلام الآن. نتمنى أن تستمتع بقهوتك!" :
    orderStatus === "ready" ? "تمام! طلبك أصبح جاهزاً. تفضل للاستلام من الفرع." :
    orderStatus === "in_progress" || orderStatus === "preparing" ? "قيد الإعداد - فريقنا يحضر طلبك الآن بعناية." :
    orderStatus === "cancelled" ? "تم إلغاء طلبك. إذا كان لديك أي استفسار، تواصل معنا." :
    "قيد المعالجة - سيتم تحديثك قريباً.";

  return sendMail({
    to: customerEmail,
    subject: `تحديث طلبك - ${orderId}`,
    text: `مرحباً ${customerName}\n\nرقم الطلب: ${orderId}\nالحالة: ${statusAr}\nالمبلغ: ${orderTotal} ريال\n\n${message}\n\nCLUNY CAFE`,
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8">
      <style>
        body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f5f5f5;}
        .wrap{background:#f5f5f5;padding:20px;}
        .box{max-width:500px;margin:0 auto;background:#fff;padding:30px;}
        .hdr{text-align:center;border-bottom:2px solid #8B5A2B;padding-bottom:20px;margin-bottom:20px;}
        .hdr h1{color:#8B5A2B;font-size:28px;margin:10px 0;}
        .status{background:${statusColor};color:#fff;padding:20px;text-align:center;margin:20px 0;border-radius:5px;}
        .status-val{font-size:24px;font-weight:bold;}
        .details{background:#f9f9f9;padding:15px;margin:20px 0;border-right:3px solid #8B5A2B;}
        .msg{background:#faf5f0;padding:15px;margin:20px 0;border-radius:5px;color:#5c3d2e;font-size:14px;line-height:1.5;}
        .ftr{border-top:1px solid #e0e0e0;padding-top:15px;font-size:12px;color:#888;text-align:center;margin-top:20px;}
      </style></head>
      <body><div class="wrap"><div class="box">
        <div class="hdr"><img src="https://raw.githubusercontent.com/cluny.cafe/logo.png" alt="CLUNY" style="width:120px;height:auto;margin-bottom:8px;" /><h1 style="color:#2D9B6E;font-size:22px;margin:0;">CLUNY CAFE</h1><p style="color:#666;font-size:13px;">تجربة القهوة الفاخرة</p></div>
        <p style="font-size:16px;color:#333;">مرحباً ${customerName}!</p>
        <div class="status">
          <div style="font-size:12px;margin-bottom:10px;">حالة الطلب</div>
          <div class="status-val">${statusAr}</div>
        </div>
        <div class="details">
          <div style="padding:8px 0;"><div style="color:#888;font-size:12px;font-weight:bold;">رقم الطلب</div><div style="color:#333;font-size:16px;font-weight:bold;">${orderId}</div></div>
          <div style="padding:8px 0;margin-top:10px;"><div style="color:#888;font-size:12px;font-weight:bold;">المبلغ الإجمالي</div><div style="color:#333;font-size:16px;font-weight:bold;">${orderTotal} ريال</div></div>
        </div>
        <div class="msg">${message}</div>
        <div class="ftr"><p>© 2025 CLUNY CAFE - جميع الحقوق محفوظة</p><p>هذا البريد مرسل تلقائياً. يرجى عدم الرد.</p></div>
      </div></div></body></html>
    `,
  });
}

export async function sendReferralEmail(
  customerEmail: string,
  customerName: string,
  referralCode: string
) {
  return sendMail({
    to: customerEmail,
    subject: "انضم إلى برنامج الإحالات الخاص بنا",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2>مرحباً ${customerName}</h2>
        <p>شارك رمز الإحالة الخاص بك واحصل على نقاط!</p>
        <div style="background:#4CAF50;color:#fff;padding:20px;border-radius:5px;margin:20px 0;text-align:center;">
          <p style="font-size:24px;font-weight:bold;margin:0;">${referralCode}</p>
        </div>
        <p>احصل على <strong>50 نقطة</strong> لكل صديق تحيله بنجاح!</p>
      </div>
    `,
  });
}

export async function sendLoyaltyPointsEmail(
  customerEmail: string,
  customerName: string,
  pointsEarned: number,
  totalPoints: number
) {
  return sendMail({
    to: customerEmail,
    subject: "لقد حصلت على نقاط جديدة!",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2>مبروك ${customerName}!</h2>
        <div style="background:#FFD700;padding:15px;border-radius:5px;margin:20px 0;">
          <p style="font-size:18px;"><strong>النقاط المكتسبة:</strong> +${pointsEarned}</p>
          <p style="font-size:18px;"><strong>إجمالي النقاط:</strong> ${totalPoints}</p>
        </div>
        <p>استخدم نقاطك للحصول على خصومات رائعة!</p>
      </div>
    `,
  });
}

export async function sendPromotionEmail(
  customerEmail: string,
  customerName: string,
  subject: string,
  promotionDescription: string,
  discountCode?: string
) {
  return sendMail({
    to: customerEmail,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>${promotionDescription}</p>
        ${discountCode ? `
          <div style="background:#f0f0f0;padding:15px;border-radius:5px;text-align:center;margin:20px 0;">
            <p>استخدم رمز الخصم هذا:</p>
            <p style="font-size:24px;font-weight:bold;color:#8B5A2B;margin:0;">${discountCode}</p>
          </div>
        ` : ""}
        <div style="margin-top:20px;border-top:1px solid #eee;padding-top:10px;font-size:12px;color:#888;">
          تم الإرسال بواسطة نظام CLUNY CAFE
        </div>
      </div>
    `,
  });
}

export async function sendReservationConfirmationEmail(
  customerEmail: string,
  customerName: string,
  tableNumber: string,
  reservationDate: string,
  reservationTime: string,
  numberOfGuests: number,
  expiryTime: string
) {
  const formattedDate = new Date(reservationDate).toLocaleDateString("ar");
  const formattedExpiry = new Date(expiryTime).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

  return sendMail({
    to: customerEmail,
    subject: `تأكيد حجزك - طاولة ${tableNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;border:1px solid #eee;border-radius:10px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>تم تأكيد حجزك في CLUNY CAFE!</p>
        <div style="background:#f9f9f9;padding:20px;border-radius:8px;margin:20px 0;border-right:5px solid #8B5A2B;">
          <p><strong>رقم الطاولة:</strong> ${tableNumber}</p>
          <p><strong>التاريخ:</strong> ${formattedDate}</p>
          <p><strong>الوقت:</strong> ${reservationTime}</p>
          <p><strong>عدد الضيوف:</strong> ${numberOfGuests}</p>
          <p style="color:#FF6B6B;"><strong>ينتهي الحجز في:</strong> ${formattedExpiry}</p>
        </div>
        <p style="color:#666;font-size:14px;"><strong>ملاحظة:</strong> الطاولة محجوزة لمدة ساعة واحدة.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">شكراً لاختيارك CLUNY CAFE!</p>
      </div>
    `,
  });
}

export async function sendReservationExpiryWarningEmail(
  customerEmail: string,
  customerName: string,
  tableNumber: string,
  expiryTime: string
) {
  const formattedExpiry = new Date(expiryTime).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });

  return sendMail({
    to: customerEmail,
    subject: `⏰ تذكير: حجزك سينتهي بعد 15 دقيقة`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;border:2px solid #FF6B6B;border-radius:10px;">
        <h2 style="color:#FF6B6B;">تنبيه!</h2>
        <p>مرحباً ${customerName}</p>
        <div style="background:#FFE5E5;padding:20px;border-radius:8px;margin:20px 0;">
          <p><strong>حجزك في الطاولة رقم ${tableNumber}</strong> سينتهي في:</p>
          <p style="font-size:24px;color:#FF6B6B;font-weight:bold;margin:10px 0;">${formattedExpiry}</p>
        </div>
        <p>يمكنك تمديد الحجز لساعة إضافية من التطبيق الآن!</p>
        <p style="font-size:12px;color:#999;">هذا البريد مرسل تلقائياً، يرجى عدم الرد.</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(customerEmail: string, customerName: string) {
  return sendMail({
    to: customerEmail,
    subject: "أهلاً بك في CLUNY CAFE! ☕",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>يسعدنا انضمامك إلينا في عائلة CLUNY CAFE.</p>
        <p>يمكنك الآن البدء في طلب قهوتك المفضلة وجمع النقاط مع كل طلب!</p>
        <p>نتطلع لخدمتك قريباً!</p>
      </div>
    `,
  });
}

export async function sendAbandonedCartEmail(customerEmail: string, customerName: string) {
  return sendMail({
    to: customerEmail,
    subject: "نسيت شيئاً في عربتك؟ 🛒",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>لاحظنا أنك تركت بعض الأصناف الرائعة في عربة التسوق الخاصة بك.</p>
        <p>لا تدع قهوتك تبرد! عد الآن وأكمل طلبك.</p>
      </div>
    `,
  });
}

export async function testEmailConnection(): Promise<boolean> {
  if (process.env.SMTP2GO_API_KEY) return true;
  try {
    const transport = await getTransporter();
    if (!transport) return false;
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendPointsVerificationEmail(
  customerEmail: string,
  customerName: string,
  code: string,
  points: number,
  valueSAR: number
) {
  return sendMail({
    to: customerEmail,
    subject: "رمز التحقق لاستبدال نقاطك",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName}</h2>
        <p>تم طلب استبدال <strong>${points} نقطة</strong> بقيمة <strong>${valueSAR.toFixed(2)} ريال</strong>.</p>
        <div style="background:#8B5A2B;color:#fff;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
          <p style="margin:0;font-size:13px;opacity:.8;">رمز التحقق</p>
          <p style="font-size:36px;font-weight:bold;letter-spacing:8px;margin:10px 0;">${code}</p>
          <p style="margin:0;font-size:12px;opacity:.7;">صالح لمدة 5 دقائق</p>
        </div>
        <p style="color:#666;font-size:13px;">إذا لم تطلب هذا الرمز، تجاهل هذا البريد.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">© 2025 CLUNY CAFE</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  customerEmail: string,
  customerName: string,
  token: string,
  resetUrl: string
) {
  return sendMail({
    to: customerEmail,
    subject: "إعادة تعيين كلمة المرور — CLUNY CAFE",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:500px;margin:0 auto;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName} 👋</h2>
        <p>تلقّينا طلباً لإعادة تعيين كلمة مرورك في تطبيق كلوني.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetUrl}" style="background:#8B5A2B;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
            إعادة تعيين كلمة المرور
          </a>
        </div>
        <p style="color:#666;font-size:13px;">هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
        <p style="color:#999;font-size:12px;">إذا لم تطلب إعادة التعيين، تجاهل هذا البريد الإلكتروني.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">© 2025 CLUNY CAFE</p>
      </div>
    `,
  });
}

export async function sendOTPEmail(
  customerEmail: string,
  customerName: string,
  otp: string
) {
  return sendMail({
    to: customerEmail,
    subject: "رمز التحقق OTP — CLUNY CAFE",
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:500px;margin:0 auto;">
        <h2 style="color:#8B5A2B;">مرحباً ${customerName} 👋</h2>
        <p>رمز التحقق الخاص بك لتسجيل الدخول إلى كلوني:</p>
        <div style="background:#8B5A2B;color:#fff;padding:20px;border-radius:8px;text-align:center;margin:20px 0;">
          <p style="margin:0;font-size:13px;opacity:.8;">رمز OTP</p>
          <p style="font-size:40px;font-weight:bold;letter-spacing:10px;margin:10px 0;">${otp}</p>
          <p style="margin:0;font-size:12px;opacity:.7;">صالح لمدة 10 دقائق</p>
        </div>
        <p style="color:#999;font-size:12px;">إذا لم تطلب هذا الرمز، تجاهل هذا البريد الإلكتروني.</p>
        <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:12px;color:#999;">© 2025 CLUNY CAFE</p>
      </div>
    `,
  });
}

export async function sendDbStorageAlertEmail(
  dbLabel: string,
  usedMb: number,
  limitMb: number
) {
  const to = process.env.NOTIFICATION_EMAIL || process.env.SMTP_FROM;
  if (!to) return false;

  const pct = Math.round((usedMb / limitMb) * 100);
  const freeMb = (limitMb - usedMb).toFixed(1);

  return sendMail({
    to,
    subject: `⚠️ تنبيه: قاعدة البيانات ${dbLabel} وصلت ${pct}% من سعتها`,
    html: `
      <div style="font-family:Arial,sans-serif;direction:rtl;padding:24px;max-width:520px;margin:0 auto;background:#f9f9f9;">
        <div style="background:#fff;border-radius:10px;padding:28px;border-top:5px solid #e53e3e;">
          <h2 style="color:#e53e3e;margin-top:0;">⚠️ تنبيه تخزين قاعدة البيانات</h2>
          <p style="color:#333;font-size:15px;">
            قاعدة البيانات <strong>${dbLabel}</strong> اقتربت من الامتلاء وتحتاج إلى انتباهك.
          </p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#fff5f5;">
              <td style="padding:12px 16px;color:#666;border-bottom:1px solid #eee;">قاعدة البيانات</td>
              <td style="padding:12px 16px;font-weight:bold;color:#333;border-bottom:1px solid #eee;">${dbLabel}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#666;border-bottom:1px solid #eee;">المساحة المستخدمة</td>
              <td style="padding:12px 16px;font-weight:bold;color:#e53e3e;border-bottom:1px solid #eee;">${usedMb.toFixed(1)} MB</td>
            </tr>
            <tr style="background:#fff5f5;">
              <td style="padding:12px 16px;color:#666;border-bottom:1px solid #eee;">الحد الأقصى</td>
              <td style="padding:12px 16px;font-weight:bold;color:#333;border-bottom:1px solid #eee;">${limitMb} MB</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;color:#666;border-bottom:1px solid #eee;">المساحة المتبقية</td>
              <td style="padding:12px 16px;font-weight:bold;color:#333;border-bottom:1px solid #eee;">${freeMb} MB</td>
            </tr>
            <tr style="background:#fff5f5;">
              <td style="padding:12px 16px;color:#666;">نسبة الاستخدام</td>
              <td style="padding:12px 16px;font-weight:bold;color:#e53e3e;">${pct}%</td>
            </tr>
          </table>
          <div style="background:#fff5f5;border-right:4px solid #e53e3e;padding:14px 16px;border-radius:4px;margin-bottom:20px;">
            <p style="margin:0;color:#c53030;font-size:14px;">
              سيتم التحويل التلقائي إلى قاعدة البيانات التالية عند بلوغ ${limitMb} MB.
              إذا لم تكن قاعدة بيانات احتياطية متاحة، قد يتوقف النظام.
            </p>
          </div>
          <p style="color:#999;font-size:12px;margin-bottom:0;">© QIROX Systems — تنبيه تلقائي</p>
        </div>
      </div>
    `,
  });
}

// ─── Employee Welcome Email ───────────────────────────────────────────────────
export async function sendEmployeeWelcomeEmail(
  employeeEmail: string,
  employeeName: string,
  username: string,
  plainPassword: string,
  role: string
) {
  const roleAr =
    role === "owner" ? "مالك" :
    role === "admin" ? "مدير عام" :
    role === "manager" ? "مدير فرع" :
    role === "cashier" ? "كاشير" :
    role === "barista" ? "باريستا" :
    role === "kitchen" ? "مطبخ" :
    role === "delivery" ? "توصيل" : role;

  return sendMail({
    to: employeeEmail,
    subject: "مرحباً بك في فريق CLUNY CAFE ☕",
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#2D9B6E,#1a7a54);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:bold;">CLUNY CAFE</h1>
            <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">نظام إدارة كلوني</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#2D9B6E;margin-top:0;">مرحباً ${employeeName}! 👋</h2>
            <p style="color:#444;line-height:1.7;">تم إنشاء حسابك في نظام CLUNY SYSTEMS. يمكنك الآن تسجيل الدخول باستخدام البيانات التالية:</p>
            <div style="background:#f8fdf9;border:2px solid #2D9B6E;border-radius:10px;padding:20px;margin:20px 0;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#666;font-size:13px;width:40%;">الوظيفة</td>
                  <td style="padding:8px 0;color:#333;font-weight:bold;">${roleAr}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#666;font-size:13px;">اسم المستخدم</td>
                  <td style="padding:8px 0;color:#2D9B6E;font-weight:bold;font-size:18px;letter-spacing:1px;">${username}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#666;font-size:13px;">كلمة المرور</td>
                  <td style="padding:8px 0;color:#333;font-weight:bold;font-size:18px;letter-spacing:2px;">${plainPassword}</td>
                </tr>
              </table>
            </div>
            <div style="background:#fff8e1;border-right:4px solid #f59e0b;border-radius:4px;padding:12px 16px;margin:16px 0;">
              <p style="margin:0;color:#92400e;font-size:13px;">⚠️ يُنصح بتغيير كلمة المرور فور تسجيل الدخول لأول مرة.</p>
            </div>
            <div style="text-align:center;margin:24px 0;">
              <a href="${process.env.APP_URL || 'https://cluny.cafe'}/employee/login"
                style="background:#2D9B6E;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;font-size:15px;">
                تسجيل الدخول الآن
              </a>
            </div>
          </div>
          <div style="background:#f8f8f8;padding:16px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} CLUNY CAFE — هذا البريد مرسل تلقائياً</p>
          </div>
        </div>
      </body></html>
    `,
  });
}

// ─── Employee Password Reset OTP ──────────────────────────────────────────────
export async function sendEmployeePasswordResetOTP(
  employeeEmail: string,
  employeeName: string,
  otp: string
) {
  return sendMail({
    to: employeeEmail,
    subject: "رمز إعادة تعيين كلمة المرور — CLUNY SYSTEMS",
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <div style="max-width:480px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#2D9B6E,#1a7a54);padding:28px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">🔐 CLUNY SYSTEMS</h1>
          </div>
          <div style="padding:32px;text-align:center;">
            <h2 style="color:#333;margin-top:0;">مرحباً ${employeeName}</h2>
            <p style="color:#666;font-size:14px;">تم طلب إعادة تعيين كلمة المرور. استخدم الرمز التالي:</p>
            <div style="background:linear-gradient(135deg,#2D9B6E,#1a7a54);border-radius:12px;padding:24px;margin:20px 0;display:inline-block;width:100%;box-sizing:border-box;">
              <p style="margin:0;color:rgba(255,255,255,.7);font-size:12px;">رمز التحقق</p>
              <p style="margin:8px 0 4px;font-size:42px;font-weight:bold;letter-spacing:10px;color:#fff;">${otp}</p>
              <p style="margin:0;color:rgba(255,255,255,.6);font-size:12px;">صالح لمدة 10 دقائق فقط</p>
            </div>
            <p style="color:#999;font-size:12px;margin-top:20px;">إذا لم تطلب هذا الرمز، تجاهل هذا البريد.</p>
          </div>
          <div style="background:#f8f8f8;padding:16px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} CLUNY CAFE</p>
          </div>
        </div>
      </body></html>
    `,
  });
}

// ─── Admin Daily Report Email ─────────────────────────────────────────────────
export async function sendDailyReportEmail(data: {
  orderCount: number;
  totalRevenue: number;
  bestSeller?: [string, number] | null;
  lowStockCount: number;
  lowStockItems?: string[];
  date: string;
}) {
  const adminEmail = process.env.ADMIN_REPORT_EMAIL;
  if (!adminEmail) return false;

  const { orderCount, totalRevenue, bestSeller, lowStockCount, lowStockItems, date } = data;

  return sendMail({
    to: adminEmail,
    subject: `📊 تقرير يومي — ${date} | CLUNY CAFE`,
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#2D9B6E,#1a7a54);padding:28px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">📊 التقرير اليومي</h1>
            <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">${date}</p>
          </div>
          <div style="padding:28px;">
            <div style="display:grid;gap:12px;">
              <div style="background:#f0fdf4;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">📦</div>
                <div>
                  <div style="color:#666;font-size:12px;">إجمالي الطلبات</div>
                  <div style="color:#2D9B6E;font-size:28px;font-weight:bold;">${orderCount}</div>
                </div>
              </div>
              <div style="background:#f0fdf4;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">💰</div>
                <div>
                  <div style="color:#666;font-size:12px;">إجمالي الإيرادات</div>
                  <div style="color:#2D9B6E;font-size:28px;font-weight:bold;">${totalRevenue.toFixed(2)} <span style="font-size:14px;">ر.س</span></div>
                </div>
              </div>
              ${bestSeller ? `
              <div style="background:#f0fdf4;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">🏆</div>
                <div>
                  <div style="color:#666;font-size:12px;">الأكثر مبيعاً</div>
                  <div style="color:#333;font-size:18px;font-weight:bold;">${bestSeller[0]}</div>
                  <div style="color:#2D9B6E;font-size:13px;">${bestSeller[1]} طلب</div>
                </div>
              </div>` : ''}
              ${lowStockCount > 0 ? `
              <div style="background:#fff8f0;border:1px solid #f59e0b;border-radius:10px;padding:20px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                  <div style="font-size:28px;">⚠️</div>
                  <div>
                    <div style="color:#92400e;font-weight:bold;">مخزون منخفض</div>
                    <div style="color:#666;font-size:13px;">${lowStockCount} صنف يحتاج تجديد</div>
                  </div>
                </div>
                ${lowStockItems?.length ? `<div style="color:#666;font-size:13px;border-top:1px solid #fde68a;padding-top:10px;">${lowStockItems.join(' ، ')}</div>` : ''}
              </div>` : `
              <div style="background:#f0fdf4;border-radius:10px;padding:16px;text-align:center;color:#2D9B6E;font-size:14px;">
                ✅ المخزون في المستوى الجيد
              </div>`}
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="${process.env.APP_URL || 'https://cluny.cafe'}/manager/dashboard"
                style="background:#2D9B6E;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
                عرض التقارير التفصيلية
              </a>
            </div>
          </div>
          <div style="background:#f8f8f8;padding:16px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} CLUNY CAFE — تقرير تلقائي يومي</p>
          </div>
        </div>
      </body></html>
    `,
  });
}

// ─── Admin Weekly Report Email ────────────────────────────────────────────────
export async function sendWeeklyReportEmail(data: {
  orderCount: number;
  totalRevenue: number;
  avgDaily: number;
  bestSeller?: [string, number] | null;
  lowStockCount: number;
  weekLabel: string;
}) {
  const adminEmail = process.env.ADMIN_REPORT_EMAIL;
  if (!adminEmail) return false;

  const { orderCount, totalRevenue, avgDaily, bestSeller, lowStockCount, weekLabel } = data;

  return sendMail({
    to: adminEmail,
    subject: `📈 التقرير الأسبوعي — ${weekLabel} | CLUNY CAFE`,
    html: `
      <html dir="rtl" lang="ar">
      <head><meta charset="UTF-8"></head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.1);">
          <div style="background:linear-gradient(135deg,#1a5c8e,#2196F3);padding:28px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">📈 التقرير الأسبوعي</h1>
            <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">${weekLabel}</p>
          </div>
          <div style="padding:28px;">
            <div style="display:grid;gap:12px;">
              <div style="background:#e8f4fd;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">📦</div>
                <div>
                  <div style="color:#666;font-size:12px;">إجمالي الطلبات (7 أيام)</div>
                  <div style="color:#2196F3;font-size:28px;font-weight:bold;">${orderCount}</div>
                </div>
              </div>
              <div style="background:#e8f4fd;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">💰</div>
                <div>
                  <div style="color:#666;font-size:12px;">إجمالي الإيرادات (7 أيام)</div>
                  <div style="color:#2196F3;font-size:28px;font-weight:bold;">${totalRevenue.toFixed(2)} <span style="font-size:14px;">ر.س</span></div>
                </div>
              </div>
              <div style="background:#e8f4fd;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">📅</div>
                <div>
                  <div style="color:#666;font-size:12px;">المتوسط اليومي</div>
                  <div style="color:#2196F3;font-size:24px;font-weight:bold;">${avgDaily.toFixed(2)} <span style="font-size:14px;">ر.س</span></div>
                </div>
              </div>
              ${bestSeller ? `
              <div style="background:#e8f4fd;border-radius:10px;padding:20px;display:flex;align-items:center;gap:16px;">
                <div style="font-size:32px;">🏆</div>
                <div>
                  <div style="color:#666;font-size:12px;">الأكثر مبيعاً هذا الأسبوع</div>
                  <div style="color:#333;font-size:18px;font-weight:bold;">${bestSeller[0]}</div>
                  <div style="color:#2196F3;font-size:13px;">${bestSeller[1]} طلب</div>
                </div>
              </div>` : ''}
              ${lowStockCount > 0 ? `
              <div style="background:#fff8f0;border:1px solid #f59e0b;border-radius:10px;padding:16px;text-align:center;color:#92400e;">
                ⚠️ يوجد ${lowStockCount} صنف في المخزون يحتاج إعادة طلب
              </div>` : ''}
            </div>
            <div style="text-align:center;margin-top:24px;">
              <a href="${process.env.APP_URL || 'https://cluny.cafe'}/manager/dashboard"
                style="background:#2196F3;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
                عرض التقارير التفصيلية
              </a>
            </div>
          </div>
          <div style="background:#f8f8f8;padding:16px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">© ${new Date().getFullYear()} CLUNY CAFE — تقرير تلقائي أسبوعي (كل جمعة)</p>
          </div>
        </div>
      </body></html>
    `,
  });
}

// Abandoned cart checker
setInterval(async () => {
  try {
    const { CartItemModel } = await import("@shared/schema");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const abandonedCarts = await CartItemModel.find({
      createdAt: { $gte: twoHoursAgo, $lte: oneHourAgo },
    }).distinct("sessionId");
    if (abandonedCarts.length > 0) {
      console.log(`[CART] ${abandonedCarts.length} potentially abandoned cart(s) detected.`);
    }
  } catch {
    // Non-critical background task
  }
}, 30 * 60 * 1000);
