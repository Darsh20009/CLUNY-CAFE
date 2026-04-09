# دليل النشر على Vercel

## الخطوات المطلوبة للنشر:

### 1. إعداد قاعدة البيانات

قبل النشر، يجب أن يكون لديك قاعدة بيانات PostgreSQL. يمكنك استخدام:
- **Neon** (مجاني): https://neon.tech
- **Supabase** (مجاني): https://supabase.com
- **Vercel Postgres** (مدفوع): https://vercel.com/storage/postgres

### 2. الحصول على DATABASE_URL

بعد إنشاء قاعدة البيانات، احصل على `DATABASE_URL` الخاص بها. يجب أن يكون بهذا الشكل:
```
postgresql://username:password@host:5432/database?sslmode=require
```

### 3. إعداد متغيرات البيئة في Vercel

في لوحة تحكم Vercel:

1. اذهب إلى Project Settings → Environment Variables
2. أضف المتغيرات التالية:

```
DATABASE_URL=postgresql://...
NODE_ENV=production
```

### 4. النشر

يمكنك النشر بطريقتين:

#### أ) عبر Vercel CLI:
```bash
npm install -g vercel
vercel --prod
```

#### ب) عبر GitHub:
1. ادفع الكود إلى GitHub
2. اربط المستودع مع Vercel
3. سيتم النشر تلقائياً عند كل push

### 5. ملاحظات مهمة

- تأكد من أن `DATABASE_URL` يحتوي على `?sslmode=require` في النهاية للاتصال الآمن
- قاعدة البيانات ستُنشأ تلقائياً أثناء عملية البناء
- إذا واجهت مشاكل في قاعدة البيانات، تحقق من أن قاعدة البيانات تدعم SSL

### 6. التحقق من النشر

بعد النشر الناجح:
1. افتح رابط Vercel الخاص بك
2. تحقق من أن التطبيق يعمل
3. سجل دخول كموظف للتأكد من اتصال قاعدة البيانات

## حل المشاكل الشائعة

### خطأ "no schema has been selected"
- تأكد من أن DATABASE_URL صحيح
- تحقق من أن قاعدة البيانات تسمح بالاتصال من Vercel

### خطأ "No Output Directory"
- تم حل هذا في `vercel.json`
- تأكد من أن الملف موجود في المستودع

### خطأ SSL/TLS
- أضف `?sslmode=require` إلى نهاية DATABASE_URL
- أو استخدم `?ssl=true`
