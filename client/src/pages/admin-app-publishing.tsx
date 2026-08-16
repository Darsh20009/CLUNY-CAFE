import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  CheckCircle2, Circle, AlertCircle, Smartphone, Apple, Play, ChevronRight,
  Download, ExternalLink, FileText, Shield, Star, Users, Globe, Package,
  Lock, Bell, Image, Palette, Info, ClipboardList, Rocket, MonitorSmartphone,
  Clock, UserCheck, StoreIcon, Settings2, ArrowRight, Copy, Check, Zap,
  BarChart3, HelpCircle, BookOpen
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type CheckStatus = 'done' | 'pending' | 'warn';

interface CheckItem {
  id: string;
  label: string;
  description?: string;
  link?: string;
  linkLabel?: string;
}

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  items: CheckItem[];
}

const googlePlaySections: Section[] = [
  {
    id: 'app-info',
    title: 'معلومات التطبيق الأساسية',
    icon: Info,
    items: [
      { id: 'privacy', label: 'سياسة الخصوصية', description: 'أضف رابط سياسة الخصوصية للتطبيق - إلزامي لجميع التطبيقات', link: 'https://play.google.com/console', linkLabel: 'Google Play Console' },
      { id: 'app-access', label: 'إمكانية وصول التطبيق', description: 'حدد ما إذا كان التطبيق يتطلب تسجيل دخول للوصول لجميع ميزاته' },
      { id: 'ads', label: 'الإعلانات', description: 'أفصح عن وجود إعلانات داخل التطبيق أو غيابها' },
      { id: 'content-rating', label: 'تصنيف المحتوى', description: 'أكمل الاستبيان للحصول على التصنيف العمري المناسب (مطعم/كافيه: للجميع)' },
      { id: 'target-audience', label: 'الجمهور المستهدف', description: 'حدد الفئة العمرية للمستخدمين (13+ يُنصح للتطبيقات التجارية)' },
      { id: 'data-safety', label: 'أمان البيانات', description: 'اشرح كيف تجمع وتستخدم وتشارك بيانات المستخدمين' },
      { id: 'category', label: 'فئة التطبيق', description: 'اختر فئة مناسبة مثل: Food & Drink أو Business' },
      { id: 'contact', label: 'معلومات التواصل', description: 'أضف بريد إلكتروني وموقع ويب لدعم المستخدمين' },
    ]
  },
  {
    id: 'store-listing',
    title: 'صفحة المتجر',
    icon: StoreIcon,
    items: [
      { id: 'app-name', label: 'اسم التطبيق', description: 'الاسم المعروض في المتجر (حتى 50 حرفاً) - مثال: Cluny Cafe - إدارة المقاهي' },
      { id: 'short-desc', label: 'الوصف المختصر', description: 'وصف قصير حتى 80 حرفاً يظهر في نتائج البحث' },
      { id: 'full-desc', label: 'الوصف الكامل', description: 'وصف تفصيلي حتى 4000 حرف لجميع مميزات التطبيق' },
      { id: 'icon', label: 'أيقونة التطبيق', description: '512×512 بكسل PNG بدون زوايا دائرية (يطبقها المتجر تلقائياً)' },
      { id: 'feature-graphic', label: 'الصورة الترويجية', description: '1024×500 بكسل، تظهر في أعلى صفحة التطبيق' },
      { id: 'screenshots', label: 'لقطات الشاشة', description: 'على الأقل 2 لقطة شاشة للهاتف (2-8 لقطات موصى بها)، 16:9 أو 9:16' },
    ]
  },
  {
    id: 'closed-testing',
    title: 'الاختبار المغلق (مطلوب قبل الإطلاق)',
    icon: UserCheck,
    items: [
      { id: 'testers-12', label: 'اشتراك 12 مختبراً على الأقل', description: 'يجب أن يشترك 12 مختبراً فعلياً في الاختبار المغلق ويقبلوا الدعوة' },
      { id: 'test-14days', label: 'إجراء الاختبار لمدة 14 يوماً', description: 'يجب أن يستمر الاختبار المغلق لمدة 14 يوماً على الأقل قبل التقديم للإنتاج' },
      { id: 'create-release', label: 'إنشاء إصدار الاختبار المغلق', description: 'قم بتحميل ملف AAB وأنشئ الإصدار الأول للاختبار' },
      { id: 'countries', label: 'تحديد الدول والمناطق', description: 'حدد الدول التي سيكون فيها التطبيق متاحاً في مرحلة الاختبار' },
      { id: 'google-review', label: 'إرسال الإصدار لمراجعة Google', description: 'بعد إنشاء الإصدار، أرسله لمراجعة Google (قد تستغرق 1-7 أيام)' },
    ]
  },
  {
    id: 'production',
    title: 'الإطلاق في الإنتاج',
    icon: Rocket,
    items: [
      { id: 'closed-test-done', label: 'اجتياز الاختبار المغلق بنجاح', description: '12+ مختبر، 14+ يوماً، تلقي موافقة Google على الاختبار المغلق' },
      { id: 'apply-production', label: 'التقديم للوصول للإنتاج', description: 'بعد اجتياز الاختبار، تقدم للوصول لإطلاق التطبيق لجميع المستخدمين' },
      { id: 'production-release', label: 'إنشاء إصدار الإنتاج', description: 'أنشئ إصدار إنتاج وأرسله لمراجعة Google النهائية' },
    ]
  }
];

const appleStoreSections: Section[] = [
  {
    id: 'apple-account',
    title: 'الحساب والإعداد',
    icon: Apple,
    items: [
      { id: 'dev-account', label: 'حساب مطور Apple', description: 'اشترك في برنامج مطوري Apple ($99/سنة)', link: 'https://developer.apple.com/programs/', linkLabel: 'Apple Developer Program' },
      { id: 'app-store-connect', label: 'حساب App Store Connect', description: 'سجل دخول وأنشئ تطبيقك الجديد في App Store Connect', link: 'https://appstoreconnect.apple.com', linkLabel: 'App Store Connect' },
      { id: 'bundle-id', label: 'Bundle Identifier', description: 'أنشئ Bundle ID فريد مثل: com.clunycafe.app في Apple Developer Portal' },
      { id: 'certificates', label: 'الشهادات والملفات', description: 'أنشئ Distribution Certificate و Provisioning Profile للنشر' },
    ]
  },
  {
    id: 'apple-info',
    title: 'معلومات التطبيق',
    icon: Info,
    items: [
      { id: 'app-name-apple', label: 'اسم التطبيق', description: 'حتى 30 حرفاً، يجب أن يكون فريداً في المتجر' },
      { id: 'subtitle', label: 'العنوان الفرعي', description: 'حتى 30 حرفاً، يوضح وظيفة التطبيق الرئيسية' },
      { id: 'promotional-text', label: 'النص الترويجي', description: 'حتى 170 حرفاً، يمكن تغييره بدون إصدار جديد' },
      { id: 'description-apple', label: 'الوصف الكامل', description: 'حتى 4000 حرف، اشرح جميع مميزات التطبيق بوضوح' },
      { id: 'keywords', label: 'الكلمات المفتاحية', description: 'حتى 100 حرف، كلمات تساعد في البحث عن تطبيقك' },
      { id: 'category-apple', label: 'الفئة الأساسية', description: 'اختر: Food & Drink أو Business كفئة رئيسية' },
      { id: 'privacy-apple', label: 'رابط سياسة الخصوصية', description: 'إلزامي - رابط URL لسياسة الخصوصية الخاصة بتطبيقك' },
    ]
  },
  {
    id: 'apple-assets',
    title: 'المواد البصرية',
    icon: Image,
    items: [
      { id: 'icon-apple', label: 'أيقونة التطبيق', description: '1024×1024 بكسل PNG، بدون زوايا دائرية، بدون شفافية' },
      { id: 'screenshots-iphone', label: 'لقطات شاشة iPhone', description: 'مطلوب: 6.9 بوصة (iPhone 16 Pro Max) - من 2 إلى 10 لقطات' },
      { id: 'screenshots-ipad', label: 'لقطات شاشة iPad (اختياري)', description: '13 بوصة iPad Pro إذا كنت تريد دعم iPad' },
      { id: 'preview-video', label: 'مقطع فيديو معاينة (اختياري)', description: 'حتى 30 ثانية لإظهار مميزات التطبيق' },
    ]
  },
  {
    id: 'apple-review',
    title: 'المراجعة والإطلاق',
    icon: CheckCircle2,
    items: [
      { id: 'age-rating', label: 'التصنيف العمري', description: 'أكمل الاستبيان - التطبيقات التجارية عادة تصنيف 4+ أو 12+' },
      { id: 'pricing', label: 'السعر والتوفر', description: 'حدد إذا كان التطبيق مجاني أم مدفوع، وحدد الدول المتاح فيها' },
      { id: 'export-compliance', label: 'الامتثال للتصدير', description: 'أجب على أسئلة التشفير (إذا كنت تستخدم HTTPS فقط: لا تشفير إضافي)' },
      { id: 'test-account', label: 'حساب اختباري', description: 'وفر حساب demo للمراجع بـ username وpassword للتحقق من التطبيق' },
      { id: 'review-notes', label: 'ملاحظات للمراجع', description: 'اشرح أي ميزات خاصة أو متطلبات لفهم التطبيق بشكل صحيح' },
      { id: 'submit-review', label: 'إرسال للمراجعة', description: 'أرسل للمراجعة - تستغرق عادة 24-48 ساعة' },
    ]
  }
];

const pwaSections: Section[] = [
  {
    id: 'pwa-basics',
    title: 'أساسيات PWA',
    icon: Globe,
    items: [
      { id: 'manifest', label: 'ملف Web App Manifest', description: 'ملف manifest.json يحتوي على اسم التطبيق والألوان والأيقونات' },
      { id: 'service-worker', label: 'Service Worker', description: 'يتيح للتطبيق العمل بدون اتصال وتحميل سريع' },
      { id: 'https', label: 'نطاق HTTPS', description: 'التطبيق يعمل على نطاق آمن بشهادة SSL صحيحة' },
      { id: 'responsive', label: 'تصميم متجاوب', description: 'التطبيق يعمل بشكل مثالي على الهواتف والأجهزة اللوحية' },
      { id: 'icons', label: 'أيقونات بأحجام متعددة', description: 'أيقونات بأحجام: 192×192 و 512×512 على الأقل' },
    ]
  },
  {
    id: 'capacitor',
    title: 'تحويل لتطبيق أصيل (Capacitor)',
    icon: Smartphone,
    items: [
      { id: 'install-capacitor', label: 'تثبيت Capacitor', description: 'npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios' },
      { id: 'init-capacitor', label: 'تهيئة Capacitor', description: 'npx cap init ثم إعداد appId و appName في capacitor.config.ts' },
      { id: 'build-app', label: 'بناء التطبيق للإنتاج', description: 'npm run build لإنتاج ملفات dist' },
      { id: 'add-platforms', label: 'إضافة المنصات', description: 'npx cap add android و npx cap add ios' },
      { id: 'sync-capacitor', label: 'مزامنة الملفات', description: 'npx cap sync لنقل ملفات البناء لمشاريع Android و iOS' },
      { id: 'open-android', label: 'فتح في Android Studio', description: 'npx cap open android ثم بناء وتوليد ملف AAB' },
      { id: 'open-ios', label: 'فتح في Xcode', description: 'npx cap open ios (يتطلب Mac) ثم أرشيف ورفع للمتجر' },
    ]
  }
];

const appStoreLinks = [
  { platform: 'Google Play Console', url: 'https://play.google.com/console', icon: Play, color: 'text-green-600' },
  { platform: 'App Store Connect', url: 'https://appstoreconnect.apple.com', icon: Apple, color: 'text-gray-800' },
  { platform: 'Apple Developer Portal', url: 'https://developer.apple.com', icon: Apple, color: 'text-blue-600' },
  { platform: 'Google Play Academy', url: 'https://play.google.com/academy', icon: BookOpen, color: 'text-green-700' },
];

const capacitorCommands = [
  { step: '1', cmd: 'npm install @capacitor/core @capacitor/cli', desc: 'تثبيت Capacitor' },
  { step: '2', cmd: 'npm install @capacitor/android @capacitor/ios', desc: 'تثبيت منصات Android و iOS' },
  { step: '3', cmd: 'npx cap init "Cluny Cafe" "com.clunycafe.app"', desc: 'تهيئة Capacitor مع اسم التطبيق وID' },
  { step: '4', cmd: 'npm run build', desc: 'بناء التطبيق للإنتاج' },
  { step: '5', cmd: 'npx cap add android', desc: 'إضافة منصة Android' },
  { step: '6', cmd: 'npx cap add ios', desc: 'إضافة منصة iOS (يتطلب Mac)' },
  { step: '7', cmd: 'npx cap sync', desc: 'مزامنة الملفات مع المنصات' },
  { step: '8', cmd: 'npx cap open android', desc: 'فتح Android Studio لبناء ملف AAB' },
  { step: '9', cmd: 'npx cap open ios', desc: 'فتح Xcode لرفع للـ App Store' },
];

function ChecklistSection({ sections, storageKey }: { sections: Section[], storageKey: string }) {
  const savedState = (): Record<string, CheckStatus> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch { return {}; }
  };

  const [checks, setChecks] = useState<Record<string, CheckStatus>>(savedState);
  const { toast } = useToast();

  const toggleCheck = (id: string) => {
    const current = checks[id];
    const next: CheckStatus = current === 'done' ? 'pending' : 'done';
    const newChecks = { ...checks, [id]: next };
    setChecks(newChecks);
    localStorage.setItem(storageKey, JSON.stringify(newChecks));
    if (next === 'done') {
      toast({ title: '✅ تم التأشير كمكتمل', description: 'تقدمك محفوظ تلقائياً' });
    }
  };

  const allItems = sections.flatMap(s => s.items);
  const doneCount = allItems.filter(i => checks[i.id] === 'done').length;
  const total = allItems.length;
  const percent = Math.round((doneCount / total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">
          {doneCount} من {total} خطوة مكتملة
        </span>
        <Badge variant={percent === 100 ? 'default' : 'secondary'} className={percent === 100 ? 'bg-green-600' : ''}>
          {percent}%
        </Badge>
      </div>
      <Progress value={percent} className="h-2 mb-4" />

      <Accordion type="multiple" defaultValue={sections.map(s => s.id)}>
        {sections.map(section => {
          const Icon = section.icon;
          const sectionItems = section.items;
          const sectionDone = sectionItems.filter(i => checks[i.id] === 'done').length;
          return (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg mb-3 overflow-hidden">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/30">
                <div className="flex items-center gap-3 flex-1 text-right">
                  <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/30">
                    <Icon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="font-semibold">{section.title}</span>
                  <Badge variant="outline" className="mr-auto text-xs">
                    {sectionDone}/{sectionItems.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                <div className="space-y-2 mt-2">
                  {sectionItems.map(item => {
                    const status = checks[item.id] || 'pending';
                    return (
                      <div
                        key={item.id}
                        data-testid={`checklist-item-${item.id}`}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          status === 'done'
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                            : 'bg-muted/20 border-border hover:bg-muted/40'
                        }`}
                        onClick={() => toggleCheck(item.id)}
                      >
                        <div className="mt-0.5 shrink-0">
                          {status === 'done' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline mt-1"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                              {item.linkLabel || item.link}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function CommandCard({ command, step, desc }: { command: string, step: string, desc: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    toast({ title: 'تم النسخ!', description: command });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white" data-testid={`command-step-${step}`}>
      <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-1">{desc}</p>
        <code className="text-xs font-mono text-green-400 break-all">{command}</code>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="text-slate-400 hover:text-white h-7 w-7 p-0 shrink-0"
        onClick={copy}
        data-testid={`copy-command-${step}`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

export default function AdminAppPublishing() {
  const googleSavedState = (): Record<string, CheckStatus> => {
    try { return JSON.parse(localStorage.getItem('google-publish-checks') || '{}'); } catch { return {}; }
  };
  const appleSavedState = (): Record<string, CheckStatus> => {
    try { return JSON.parse(localStorage.getItem('apple-publish-checks') || '{}'); } catch { return {}; }
  };

  const googleAllItems = googlePlaySections.flatMap(s => s.items);
  const appleAllItems = appleStoreSections.flatMap(s => s.items);

  const [googleChecks] = useState<Record<string, CheckStatus>>(googleSavedState);
  const [appleChecks] = useState<Record<string, CheckStatus>>(appleSavedState);

  const googleDone = googleAllItems.filter(i => googleChecks[i.id] === 'done').length;
  const appleDone = appleAllItems.filter(i => appleChecks[i.id] === 'done').length;
  const googlePercent = Math.round((googleDone / googleAllItems.length) * 100);
  const applePercent = Math.round((appleDone / appleAllItems.length) * 100);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MonitorSmartphone className="w-7 h-7 text-orange-600" />
            نشر التطبيق على المتاجر
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            دليل تفصيلي شامل لنشر تطبيق Cluny Cafe على Google Play و Apple App Store
          </p>
        </div>
        <Badge className="bg-orange-600 text-white text-xs" data-testid="status-badge">
          <Zap className="w-3 h-3 ml-1" />
          دليل تفاعلي
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-green-200 dark:border-green-800" data-testid="card-google-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-green-600 fill-green-600" />
              Google Play Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{googlePercent}%</div>
            <Progress value={googlePercent} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{googleDone} من {googleAllItems.length} خطوة</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 dark:border-blue-800" data-testid="card-apple-progress">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Apple className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              Apple App Store
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{applePercent}%</div>
            <Progress value={applePercent} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{appleDone} من {appleAllItems.length} خطوة</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-orange-200 dark:border-orange-800" data-testid="card-timeline">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              الجدول الزمني المتوقع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">تجهيز التطبيق</span>
              <span className="font-semibold">1-3 أيام</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">مراجعة Google Play</span>
              <span className="font-semibold">7-14 يوم</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">اختبار مغلق</span>
              <span className="font-semibold text-orange-600">14 يوم (إلزامي)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">مراجعة App Store</span>
              <span className="font-semibold">24-48 ساعة</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Important Notice */}
      <Card className="border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700" data-testid="card-notice">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">متطلبات مهمة</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 mt-1 space-y-1 list-disc list-inside">
                <li>Google Play يتطلب <strong>12 مختبراً على الأقل لمدة 14 يوماً</strong> قبل الإطلاق الكامل</li>
                <li>Apple يتطلب <strong>جهاز Mac</strong> لبناء وتقديم تطبيق iOS</li>
                <li>تحتاج لتثبيت <strong>Android Studio</strong> لبناء ملف AAB لـ Google Play</li>
                <li>اشتراك <strong>Apple Developer Program: $99/سنة</strong> و Google Play: <strong>$25 مرة واحدة</strong></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="google" className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="google" className="gap-2" data-testid="tab-google">
            <Play className="w-4 h-4 fill-current" />
            Google Play
          </TabsTrigger>
          <TabsTrigger value="apple" className="gap-2" data-testid="tab-apple">
            <Apple className="w-4 h-4" />
            App Store
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-2" data-testid="tab-setup">
            <Settings2 className="w-4 h-4" />
            الإعداد التقني
          </TabsTrigger>
        </TabsList>

        {/* Google Play Tab */}
        <TabsContent value="google">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-green-600 fill-green-600" />
                قائمة مراجعة Google Play Store
              </CardTitle>
              <CardDescription>
                اضغط على أي خطوة لتأشيرها كمكتملة — يتم حفظ التقدم تلقائياً
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChecklistSection sections={googlePlaySections} storageKey="google-publish-checks" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Apple App Store Tab */}
        <TabsContent value="apple">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="w-5 h-5" />
                قائمة مراجعة Apple App Store
              </CardTitle>
              <CardDescription>
                اضغط على أي خطوة لتأشيرها كمكتملة — يتم حفظ التقدم تلقائياً
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChecklistSection sections={appleStoreSections} storageKey="apple-publish-checks" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technical Setup Tab */}
        <TabsContent value="setup">
          <div className="space-y-4">
            {/* PWA Checklist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  التحقق من جاهزية التطبيق (PWA)
                </CardTitle>
                <CardDescription>
                  قبل التحويل لمتاجر التطبيقات، تأكد من اكتمال هذه المتطلبات
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChecklistSection sections={pwaSections} storageKey="pwa-checks" />
              </CardContent>
            </Card>

            {/* Capacitor Commands */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  أوامر تحويل التطبيق (Capacitor)
                </CardTitle>
                <CardDescription>
                  انسخ وشغّل هذه الأوامر بالترتيب لتحويل موقعك لتطبيق للمتاجر
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {capacitorCommands.map(cmd => (
                    <CommandCard key={cmd.step} step={cmd.step} command={cmd.cmd} desc={cmd.desc} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* App Icon Specs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5 text-pink-600" />
                  مواصفات الأيقونات ولقطات الشاشة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Play className="w-4 h-4 text-green-600 fill-green-600" />
                      <h4 className="font-semibold text-sm">Google Play</h4>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>أيقونة التطبيق</span>
                        <Badge variant="outline" className="text-xs">512×512 PNG</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>الصورة الترويجية</span>
                        <Badge variant="outline" className="text-xs">1024×500 PNG/JPG</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>لقطات الشاشة</span>
                        <Badge variant="outline" className="text-xs">320-3840px</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>حجم الملف AAB</span>
                        <Badge variant="outline" className="text-xs">حتى 150MB</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Apple className="w-4 h-4" />
                      <h4 className="font-semibold text-sm">Apple App Store</h4>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>أيقونة التطبيق</span>
                        <Badge variant="outline" className="text-xs">1024×1024 PNG</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>iPhone 16 Pro Max</span>
                        <Badge variant="outline" className="text-xs">1320×2868px</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>iPad Pro 13"</span>
                        <Badge variant="outline" className="text-xs">2064×2752px</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>فيديو المعاينة</span>
                        <Badge variant="outline" className="text-xs">حتى 30 ثانية MP4</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card data-testid="card-quick-links">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="w-4 h-4 text-orange-600" />
            روابط مهمة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {appStoreLinks.map(link => {
              const Icon = link.icon;
              return (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`link-${link.platform.toLowerCase().replace(/\s+/g, '-')}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border hover:bg-muted/40 transition-colors text-center"
                >
                  <Icon className={`w-6 h-6 ${link.color}`} />
                  <span className="text-xs font-medium text-center leading-tight">{link.platform}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground rotate-180" />
                </a>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
