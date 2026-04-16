import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  BookOpen,
  Coffee,
  Users,
  Package,
  Receipt,
  ChefHat,
  ShoppingCart,
  Settings,
  ArrowLeft,
  Search,
  Play,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  Monitor,
  Smartphone,
  BarChart3,
  FileText,
  AlertTriangle,
  Shield,
  Wallet,
  ClipboardList,
  TrendingUp,
  Bell,
  Calculator,
  Map,
  Clock,
  Star
} from "lucide-react";

interface GuideSection {
  id: string;
  title: string;
  icon: any;
  description: string;
  steps: GuideStep[];
}

interface GuideStep {
  title: string;
  content: string;
  tip?: string;
}

const guideSections: GuideSection[] = [
  {
    id: "getting-started",
    title: "البداية السريعة",
    icon: Play,
    description: "تعرف على النظام وابدأ استخدامه في دقائق",
    steps: [
      {
        title: "تسجيل الدخول",
        content: "استخدم اسم المستخدم وكلمة المرور للدخول إلى لوحة التحكم. اختر 'تذكرني' للبقاء مسجلاً.",
        tip: "إذا نسيت كلمة المرور، استخدم 'نسيت كلمة المرور' لإعادة تعيينها"
      },
      {
        title: "لوحة التحكم الرئيسية",
        content: "ستجد ملخصاً سريعاً للمبيعات والطلبات والتنبيهات. انقر على أي بطاقة للتفاصيل.",
        tip: "البطاقات الملونة تعرض أهم الإحصائيات بلمحة سريعة"
      },
      {
        title: "التنقل بين الصفحات",
        content: "استخدم القائمة الجانبية للتنقل بين أقسام النظام: الطلبات، المخزون، المحاسبة، الموظفين."
      }
    ]
  },
  {
    id: "orders",
    title: "إدارة الطلبات",
    icon: ShoppingCart,
    description: "استقبال الطلبات ومتابعتها حتى التسليم",
    steps: [
      {
        title: "استقبال طلب جديد",
        content: "الطلبات الجديدة تظهر تلقائياً مع تنبيه صوتي. انقر 'قبول' لبدء التحضير أو 'رفض' مع السبب.",
        tip: "يمكنك تفعيل/إيقاف التنبيهات الصوتية من الإعدادات"
      },
      {
        title: "تحديث حالة الطلب",
        content: "بعد القبول، انقل الطلب عبر المراحل: قيد التحضير ← جاهز ← تم التسليم. كل تحديث يُعلم العميل تلقائياً."
      },
      {
        title: "طباعة الفاتورة",
        content: "انقر على رمز الطابعة لطباعة فاتورة تتضمن QR Code متوافق مع ZATCA."
      },
      {
        title: "إلغاء الطلب",
        content: "يمكن إلغاء الطلب من أي مرحلة ما عدا 'تم التسليم'. سيُطلب منك إدخال سبب الإلغاء.",
        tip: "الإلغاءات المتكررة تظهر في تقارير الأداء"
      }
    ]
  },
  {
    id: "pos",
    title: "نقطة البيع (POS)",
    icon: Monitor,
    description: "نظام الكاشير للبيع المباشر",
    steps: [
      {
        title: "فتح نقطة البيع",
        content: "انقر على 'نقطة البيع' من القائمة. سيظهر قائمة المنتجات مرتبة حسب الفئات."
      },
      {
        title: "إضافة منتجات للسلة",
        content: "انقر على المنتج لإضافته. استخدم + و - لتعديل الكمية. انقر مطولاً لحذف المنتج."
      },
      {
        title: "تطبيق الخصم",
        content: "انقر 'خصم' لإدخال نسبة أو قيمة الخصم. يمكنك أيضاً استخدام كوبونات الخصم."
      },
      {
        title: "اختيار طريقة الدفع",
        content: "اختر: نقدي، مدى، Apple Pay، أو STC Pay. للدفع النقدي أدخل المبلغ المستلم لحساب الباقي.",
        tip: "يمكن تقسيم الدفع بين عدة طرق"
      }
    ]
  },
  {
    id: "inventory",
    title: "إدارة المخزون",
    icon: Package,
    description: "متابعة المواد الخام والتنبيهات",
    steps: [
      {
        title: "عرض المخزون",
        content: "صفحة المخزون تعرض جميع المواد الخام مع الكميات الحالية والحد الأدنى."
      },
      {
        title: "إضافة مادة جديدة",
        content: "انقر 'إضافة مادة' وأدخل: الاسم، الوحدة (جرام/مل/قطعة)، تكلفة الوحدة، الكمية الحالية، والحد الأدنى."
      },
      {
        title: "تنبيهات المخزون المنخفض",
        content: "المواد التي تصل للحد الأدنى تظهر باللون الأحمر مع تنبيه. تصلك رسالة تذكير يومية.",
        tip: "اضبط الحد الأدنى بناءً على سرعة الاستهلاك ووقت التوريد"
      },
      {
        title: "تسجيل استلام المواد",
        content: "انقر 'إضافة مخزون' وأدخل الكمية المستلمة والتكلفة. يُحدث الرصيد تلقائياً."
      }
    ]
  },
  {
    id: "recipes",
    title: "إدارة الوصفات",
    icon: ChefHat,
    description: "ربط المنتجات بالمكونات وحساب التكلفة",
    steps: [
      {
        title: "إنشاء وصفة جديدة",
        content: "اختر المنتج من القائمة، ثم أضف المكونات مع الكميات المطلوبة لكل منها."
      },
      {
        title: "حساب تكلفة الوصفة",
        content: "النظام يحسب تلقائياً تكلفة الوصفة بناءً على أسعار المكونات الحالية.",
        tip: "راجع التكلفة دورياً خاصة عند تغير أسعار الموردين"
      },
      {
        title: "الخصم التلقائي من المخزون",
        content: "عند تأكيد الطلب، يُخصم من المخزون تلقائياً حسب الوصفة المرتبطة بكل منتج."
      }
    ]
  },
  {
    id: "accounting",
    title: "المحاسبة والتقارير",
    icon: BarChart3,
    description: "متابعة الإيرادات والمصروفات والأرباح",
    steps: [
      {
        title: "لوحة المحاسبة",
        content: "تعرض ملخصاً للإيرادات، المصروفات، وصافي الربح. اختر الفترة: اليوم، الأسبوع، الشهر."
      },
      {
        title: "تسجيل مصروف",
        content: "انقر 'إضافة مصروف' واختر الفئة (إيجار، رواتب، مواد، إلخ) وأدخل المبلغ والوصف."
      },
      {
        title: "تقارير مالية",
        content: "اذهب لتبويب 'التقارير' لعرض تقارير تفصيلية مع رسومات بيانية.",
        tip: "استخدم 'تصدير Excel' لتحليل البيانات أو إرسالها للمحاسب"
      },
      {
        title: "تحليل الربحية",
        content: "تقرير الربحية يوضح هامش الربح لكل منتج، ويساعدك على تحديد المنتجات الأكثر ربحية."
      }
    ]
  },
  {
    id: "zatca",
    title: "الفوترة الإلكترونية ZATCA",
    icon: Receipt,
    description: "فواتير متوافقة مع هيئة الزكاة",
    steps: [
      {
        title: "إعداد بيانات المنشأة",
        content: "أدخل: اسم المنشأة، الرقم الضريبي، رقم السجل التجاري، والعنوان الكامل.",
        tip: "تأكد من صحة الرقم الضريبي قبل إرسال أي فاتورة"
      },
      {
        title: "إنشاء فاتورة ضريبية",
        content: "الفواتير تُنشأ تلقائياً عند إتمام الطلب. تتضمن جميع البيانات المطلوبة ورمز QR."
      },
      {
        title: "إرسال الفاتورة لـ ZATCA",
        content: "انقر 'إرسال' لإرسال الفاتورة لمنصة فاتورة. ستتلقى رد القبول أو الرفض."
      },
      {
        title: "تقارير الضريبة",
        content: "تقرير شهري يجمع ضريبة القيمة المضافة المحصلة لتقديمها للهيئة."
      }
    ]
  },
  {
    id: "employees",
    title: "إدارة الموظفين",
    icon: Users,
    description: "إضافة الموظفين وتحديد صلاحياتهم",
    steps: [
      {
        title: "إضافة موظف جديد",
        content: "انقر 'إضافة موظف' وأدخل: الاسم، الهاتف، اسم المستخدم، والدور الوظيفي."
      },
      {
        title: "الأدوار والصلاحيات",
        content: "اختر الدور المناسب: كاشير (POS فقط)، باريستا (المطبخ)، مدير (كل الصلاحيات)، مالك (الإعدادات)."
      },
      {
        title: "تحديد ورديات العمل",
        content: "حدد أيام العمل وأوقات الوردية لكل موظف. يظهر في جدول الحضور."
      },
      {
        title: "تتبع الحضور",
        content: "الموظفون يسجلون حضورهم وانصرافهم. يمكنك مراجعة السجل وتصحيح الأخطاء.",
        tip: "فعّل الموقع الجغرافي للتحقق من مكان تسجيل الحضور"
      }
    ]
  }
];

const faqData = [
  {
    question: "كيف أغير كلمة المرور؟",
    answer: "اذهب إلى الإعدادات ← الحساب ← تغيير كلمة المرور. أدخل كلمة المرور الحالية ثم الجديدة مرتين."
  },
  {
    question: "لماذا لا تظهر الطلبات الجديدة؟",
    answer: "تأكد من أن الاتصال بالإنترنت يعمل. جرب تحديث الصفحة. إذا استمرت المشكلة، تواصل مع الدعم الفني."
  },
  {
    question: "كيف أعدل سعر منتج؟",
    answer: "اذهب إلى إدارة القائمة ← اختر المنتج ← انقر 'تعديل' ← غير السعر ← احفظ."
  },
  {
    question: "كيف أضيف فرعاً جديداً؟",
    answer: "هذه الصلاحية للمالك فقط. اذهب إلى الإعدادات ← الفروع ← إضافة فرع جديد."
  },
  {
    question: "هل يمكنني استخدام النظام بدون إنترنت؟",
    answer: "النظام يحتاج اتصالاً بالإنترنت لمزامنة البيانات. في حالة الانقطاع المؤقت، البيانات تُحفظ محلياً وتُزامن عند عودة الاتصال."
  },
  {
    question: "كيف أطبع تقريراً للفترة المحددة؟",
    answer: "اختر الفترة من فلتر التاريخ، ثم انقر 'تصدير PDF' أو 'طباعة' من شريط الأدوات."
  },
  {
    question: "كيف أفعل الدفع الإلكتروني (مدى، Apple Pay)؟",
    answer: "تواصل مع الدعم لربط جهاز الدفع الإلكتروني. بمجرد الربط، ستظهر خيارات الدفع في نقطة البيع."
  },
  {
    question: "كيف أسترجع طلباً ملغياً؟",
    answer: "الطلبات الملغاة لا يمكن استرجاعها. يجب إنشاء طلب جديد إذا تغير رأي العميل."
  }
];

const tipsData = [
  {
    title: "استخدم اختصارات لوحة المفاتيح",
    content: "اضغط F1 للمساعدة، F2 لطلب جديد، ESC للإلغاء.",
    icon: Lightbulb
  },
  {
    title: "راجع التقارير أسبوعياً",
    content: "متابعة الأداء الأسبوعي تساعدك على اكتشاف المشاكل مبكراً.",
    icon: TrendingUp
  },
  {
    title: "حدّث المخزون يومياً",
    content: "الجرد اليومي يمنع الفروقات ويضمن دقة التكاليف.",
    icon: Package
  },
  {
    title: "درّب الموظفين على النظام",
    content: "موظف متمكن = خدمة أسرع وأخطاء أقل.",
    icon: Users
  }
];

export default function UserGuidePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");

  const filteredSections = guideSections.filter(section =>
    section.title.includes(searchQuery) ||
    section.description.includes(searchQuery) ||
    section.steps.some(step => step.title.includes(searchQuery) || step.content.includes(searchQuery))
  );

  const currentSection = guideSections.find(s => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-primary/5 to-yellow-50 dark:from-background dark:via-primary/5 dark:to-background" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/manager/dashboard")}
            className="text-accent dark:text-accent"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-accent dark:text-accent flex items-center gap-2">
            <BookOpen className="w-8 h-8" />
            دليل استخدام CLUNY CAFE
          </h1>
          <div className="w-20"></div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="ابحث في الدليل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-12 text-lg h-12"
          />
        </div>

        <Tabs value={activeSection} onValueChange={setActiveSection} className="space-y-6">
          <div className="flex gap-6">
            <div className="w-64 shrink-0 hidden lg:block">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    الأقسام
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="space-y-1">
                    {guideSections.map((section) => {
                      const Icon = section.icon;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          className={`w-full flex items-center gap-2 p-3 rounded-lg text-right transition-colors ${
                            activeSection === section.id
                              ? 'bg-primary dark:bg-primary/30 text-accent dark:text-accent'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-sm font-medium">{section.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 space-y-6">
              <TabsList className="grid grid-cols-4 lg:hidden bg-primary dark:bg-primary/30">
                <TabsTrigger value="getting-started" className="text-xs">البداية</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs">الطلبات</TabsTrigger>
                <TabsTrigger value="inventory" className="text-xs">المخزون</TabsTrigger>
                <TabsTrigger value="accounting" className="text-xs">المحاسبة</TabsTrigger>
              </TabsList>

              {currentSection && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary dark:bg-primary/30 rounded-xl">
                        <currentSection.icon className="w-8 h-8 text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{currentSection.title}</CardTitle>
                        <CardDescription>{currentSection.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {currentSection.steps.map((step, index) => (
                        <div key={index} className="relative pr-8 pb-6 border-r-2 border-primary dark:border-primary last:border-0 last:pb-0">
                          <div className="absolute right-0 top-0 -translate-x-1/2 w-8 h-8 bg-background0 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div className="mr-6">
                            <h4 className="font-medium text-lg mb-2">{step.title}</h4>
                            <p className="text-muted-foreground">{step.content}</p>
                            {step.tip && (
                              <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <Lightbulb className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-700 dark:text-blue-400">{step.tip}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-purple-600" />
                    الأسئلة الشائعة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {faqData.map((faq, index) => (
                      <AccordionItem key={index} value={`faq-${index}`}>
                        <AccordionTrigger className="text-right hover:no-underline">
                          <span className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-accent" />
                            {faq.question}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pr-6">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-accent" />
                    نصائح للاستخدام الأمثل
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tipsData.map((tip, index) => {
                      const Icon = tip.icon;
                      return (
                        <div key={index} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                          <div className="p-2 bg-primary dark:bg-primary/30 rounded-lg">
                            <Icon className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <h4 className="font-medium mb-1">{tip.title}</h4>
                            <p className="text-sm text-muted-foreground">{tip.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-l from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-primary">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="p-4 bg-white dark:bg-background rounded-xl shadow">
                    <Coffee className="w-10 h-10 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-accent dark:text-accent">تحتاج مساعدة إضافية؟</h3>
                    <p className="text-accent dark:text-accent">فريق الدعم الفني متاح على مدار الساعة لمساعدتك</p>
                  </div>
                  <Button className="bg-primary hover:bg-primary">
                    تواصل معنا
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
