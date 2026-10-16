import { useState } from "react";

const now = new Date();
const atDay = (daysAgo: number, hour: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 20, 0, 0);
  return date.toISOString();
};

const employees = [
  { id: "e1", fullName: "سارة العتيبي", jobTitle: "مديرة فرع", role: "manager", isActivated: 1 },
  { id: "e2", fullName: "عبدالله الحربي", jobTitle: "باريستا", role: "barista", isActivated: 1 },
  { id: "e3", fullName: "نورة القحطاني", jobTitle: "كاشير", role: "cashier", isActivated: 1 },
  { id: "e4", fullName: "فيصل الشمري", jobTitle: "باريستا", role: "barista", isActivated: 1 },
  { id: "e5", fullName: "ريم الدوسري", jobTitle: "مساعدة", role: "staff", isActivated: 0 },
];

const orders = [
  { id: "o1", employeeId: "e2", createdAt: atDay(0, 9), totalAmount: 82, status: "completed" },
  { id: "o2", employeeId: "e3", createdAt: atDay(0, 10), totalAmount: 64, status: "completed" },
  { id: "o3", employeeId: "e4", createdAt: atDay(0, 11), totalAmount: 118, status: "preparing" },
  { id: "o4", employeeId: "e2", createdAt: atDay(0, 12), totalAmount: 96, status: "pending" },
  { id: "o5", employeeId: "e3", createdAt: atDay(0, 13), totalAmount: 73, status: "completed" },
  { id: "o6", employeeId: "e4", createdAt: atDay(1, 9), totalAmount: 89, status: "completed" },
  { id: "o7", employeeId: "e2", createdAt: atDay(1, 11), totalAmount: 54, status: "cancelled" },
  { id: "o8", employeeId: "e3", createdAt: atDay(1, 13), totalAmount: 112, status: "completed" },
  { id: "o9", employeeId: "e4", createdAt: atDay(2, 10), totalAmount: 134, status: "completed" },
  { id: "o10", employeeId: "e2", createdAt: atDay(3, 12), totalAmount: 101, status: "completed" },
  { id: "o11", employeeId: "e3", createdAt: atDay(4, 14), totalAmount: 93, status: "completed" },
  { id: "o12", employeeId: "e4", createdAt: atDay(5, 11), totalAmount: 127, status: "completed" },
];

const advancedAnalytics = {
  summary: {
    totalRevenue: 3684,
    revenueChange: 12.4,
    totalOrders: 124,
    ordersChange: 8.1,
    avgOrderValue: 29.7,
    avgOrderChange: 3.2,
    changeLabel: "مقارنة بالأسبوع الماضي",
  },
  revenueTrend: [
    { date: "الأحد", current: 420 },
    { date: "الإثنين", current: 510 },
    { date: "الثلاثاء", current: 475 },
    { date: "الأربعاء", current: 690 },
    { date: "الخميس", current: 580 },
    { date: "الجمعة", current: 720 },
    { date: "السبت", current: 289 },
  ],
  topProducts: [
    { id: "p1", nameAr: "لاتيه", nameEn: "Latte", qty: 86, revenue: 1290 },
    { id: "p2", nameAr: "قهوة اليوم", nameEn: "Brewed Coffee", qty: 64, revenue: 768 },
    { id: "p3", nameAr: "سبانش لاتيه", nameEn: "Spanish Latte", qty: 52, revenue: 936 },
  ],
};

const cogs = {
  summary: { avgMargin: 66, highMargin: 9 },
  items: [
    { id: "c1", nameAr: "لاتيه", margin: 72, price: 15, profit: 10.8 },
    { id: "c2", nameAr: "قهوة اليوم", margin: 68, price: 12, profit: 8.2 },
    { id: "c3", nameAr: "سبانش لاتيه", margin: 64, price: 18, profit: 11.5 },
    { id: "c4", nameAr: "كابتشينو", margin: 61, price: 16, profit: 9.8 },
    { id: "c5", nameAr: "موكا", margin: 56, price: 19, profit: 10.6 },
  ],
};

const products = [
  { id: "p1", nameAr: "لاتيه", nameEn: "Latte", price: 15, category: "قهوة", imageUrl: "", totalQty: 86, totalRevenue: 1290, orderCount: 68, available: true },
  { id: "p2", nameAr: "قهوة اليوم", nameEn: "Brewed Coffee", price: 12, category: "قهوة", imageUrl: "", totalQty: 64, totalRevenue: 768, orderCount: 53, available: true },
  { id: "p3", nameAr: "سبانش لاتيه", nameEn: "Spanish Latte", price: 18, category: "قهوة", imageUrl: "", totalQty: 52, totalRevenue: 936, orderCount: 43, available: true },
  { id: "p4", nameAr: "كابتشينو", nameEn: "Cappuccino", price: 16, category: "قهوة", imageUrl: "", totalQty: 41, totalRevenue: 656, orderCount: 37, available: true },
  { id: "p5", nameAr: "موكا", nameEn: "Mocha", price: 19, category: "قهوة", imageUrl: "", totalQty: 29, totalRevenue: 551, orderCount: 25, available: true },
];

function getMockData(queryKey: unknown) {
  const key = Array.isArray(queryKey) ? String(queryKey[0] ?? "") : String(queryKey ?? "");
  if (key.includes("/api/analytics/advanced")) return advancedAnalytics;
  if (key.includes("/api/analytics/cogs")) return cogs;
  if (key.includes("/api/analytics/products")) return { products, totalOrders: 124 };
  if (key.includes("/api/employees")) return employees;
  if (key.includes("/api/orders")) return orders;
  if (key.includes("/api/attendance")) return [{ id: "a1", employeeId: "e2", checkIn: atDay(0, 8) }, { id: "a2", employeeId: "e3", checkIn: atDay(0, 9) }, { id: "a3", employeeId: "e4", checkIn: atDay(0, 10) }];
  if (key.includes("/api/leave-requests")) return [];
  if (key.includes("/api/business-config")) return { businessName: "CLUNY CAFE" };
  return [];
}

export function useQuery<T = unknown>(options: any): { data: T; isLoading: false; error: null } {
  return { data: getMockData(options?.queryKey) as T, isLoading: false, error: null };
}

export function useLocation(): [string, (path: string) => void] {
  const [path, setPath] = useState("/owner/dashboard");
  return [path, setPath];
}

export function useTranslation() {
  const [language, setLanguage] = useState("ar");
  return { i18n: { language, changeLanguage: setLanguage } };
}

export function useTranslate() {
  return (arabic: string, _english: string) => arabic;
}

export function getQueryFn(_options?: any) {
  return async ({ queryKey }: { queryKey: unknown }) => getMockData(queryKey);
}

export async function apiRequest(_method?: string, _path?: string) {
  return {
    json: async () => ({
      insights: [
        { text: "ارتفعت مبيعات المشروبات الباردة هذا الأسبوع." },
        { text: "يحقق فريق الفترة الصباحية أعلى متوسط للطلبات." },
      ],
    }),
  };
}
