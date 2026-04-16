# إعداد خدمة البريد الإلكتروني بـ Gmail

تم تفعيل نظام البريد الإلكتروني بـ **Nodemailer + Gmail**. إليك خطوات الإعداد:

## 1️⃣ تفعيل 2-Step Verification في Gmail
- اذهب إلى [Google Account Security](https://myaccount.google.com/security)
- ادخل إلى "2-Step Verification" وفعّله

## 2️⃣ إنشاء App Password
- في نفس صفحة الأمان، اذهب إلى "App passwords"
- اختر "Mail" و "Windows Computer"
- ستحصل على **كلمة مرور من 16 حرف**

## 3️⃣ إضافة بيانات اعتماد Gmail

أضف المتغيرات التالية في إعدادات البيئة:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

## 4️⃣ الميزات المتاحة

### تنبيهات تحديث الطلب
```
POST /api/send-order-email
Body: { orderId, orderStatus, orderTotal }
```

### رسائل برنامج الإحالات
```
POST /api/send-referral-email
```

### إشعارات النقاط
```
POST /api/send-loyalty-email
Body: { pointsEarned }
```

### الرسائل الترويجية (للمسؤولين)
```
POST /api/send-promotion-email
Body: { customerId, promotionTitle, promotionDescription, discountCode }
```

### التحقق من الاتصال
```
GET /api/email-status
```

## ⚠️ ملاحظات مهمة
- **لا تستخدم كلمة المرور العادية** - استخدم App Password فقط
- إذا لم تضيف بيانات اعتماد، الإشعارات ستُحفظ في النظام بدون إرسال بريد
- جميع الرسائل بـ **اللغة العربية** وتصميم احترافي

## ✅ للتحقق من الاتصال:
زر `/api/email-status` سيخبرك إذا كانت الخدمة متصلة أم لا

---

**تم إنجاز الإعداد! الآن الرسائل جاهزة للإرسال الفوري.**
