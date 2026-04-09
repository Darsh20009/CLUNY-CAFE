import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Eye, Trash2 } from "lucide-react";

const ROLES = [
  {
    name: "Cashier",
    nameAr: "كاشير",
    permissions: [
      "Create orders",
      "Apply discounts",
      "View sales",
      "Print receipts",
    ],
  },
  {
    name: "Barista",
    nameAr: "باريستا",
    permissions: [
      "View prep queue",
      "Update order status",
      "Mark items ready",
      "View menu",
    ],
  },
  {
    name: "Supervisor",
    nameAr: "مشرف",
    permissions: [
      "Manage discounts",
      "Void orders",
      "Refund orders",
      "View reports",
      "Manage staff",
    ],
  },
  {
    name: "Branch Manager",
    nameAr: "مدير الفرع",
    permissions: [
      "All Supervisor permissions",
      "Manage inventory",
      "View financial reports",
      "Manage branch staff",
      "Configure branch settings",
    ],
  },
  {
    name: "Owner/Admin",
    nameAr: "المالك/الإداري",
    permissions: [
      "Full system access",
      "All permissions",
      "Manage all branches",
      "View all reports",
      "System configuration",
      "User management",
    ],
  },
];

const PERMISSION_MATRIX = [
  { feature: "View Orders", cashier: true, barista: false, supervisor: true, manager: true, admin: true },
  { feature: "Create Orders", cashier: true, barista: false, supervisor: false, manager: true, admin: true },
  { feature: "Delete/Void Orders", cashier: false, barista: false, supervisor: true, manager: true, admin: true },
  { feature: "Apply Discounts", cashier: true, barista: false, supervisor: true, manager: true, admin: true },
  { feature: "View Inventory", cashier: false, barista: false, supervisor: true, manager: true, admin: true },
  { feature: "Manage Inventory", cashier: false, barista: false, supervisor: false, manager: true, admin: true },
  { feature: "View Reports", cashier: false, barista: false, supervisor: true, manager: true, admin: true },
  { feature: "View Recipes", cashier: false, barista: true, supervisor: true, manager: true, admin: true },
  { feature: "Manage Recipes", cashier: false, barista: false, supervisor: false, manager: true, admin: true },
  { feature: "Manage Users", cashier: false, barista: false, supervisor: false, manager: false, admin: true },
  { feature: "View Accounting", cashier: false, barista: false, supervisor: true, manager: true, admin: true },
  { feature: "System Settings", cashier: false, barista: false, supervisor: false, manager: false, admin: true },
];

export default function OSRolesManagement() {
  const getIcon = (permission: boolean) => {
    return permission ? (
      <Eye className="w-4 h-4 text-green-600" />
    ) : (
      <Lock className="w-4 h-4 text-gray-400" />
    );
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen text-right" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">نظام الأدوار والصلاحيات</h1>
        <Shield className="w-8 h-8 text-primary" />
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {ROLES.map((role) => (
          <Card key={role.name} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{role.nameAr}</CardTitle>
              <p className="text-xs text-muted-foreground">{role.name}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {role.permissions.slice(0, 4).map((perm, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {perm}
                  </div>
                ))}
                {role.permissions.length > 4 && (
                  <div className="text-xs text-muted-foreground italic">
                    +{role.permissions.length - 4} more
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>مصفوفة الصلاحيات التفصيلية</CardTitle>
          <CardDescription>عرض كامل للصلاحيات حسب الدور</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2">الميزة</th>
                  <th className="text-center p-2">كاشير</th>
                  <th className="text-center p-2">باريستا</th>
                  <th className="text-center p-2">مشرف</th>
                  <th className="text-center p-2">مدير</th>
                  <th className="text-center p-2">مالك</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted">
                    <td className="p-2 font-medium">{row.feature}</td>
                    <td className="p-2 text-center">{getIcon(row.cashier)}</td>
                    <td className="p-2 text-center">{getIcon(row.barista)}</td>
                    <td className="p-2 text-center">{getIcon(row.supervisor)}</td>
                    <td className="p-2 text-center">{getIcon(row.manager)}</td>
                    <td className="p-2 text-center">{getIcon(row.admin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Implementation Status */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg">حالة التنفيذ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded">
            <span>API Role Middleware</span>
            <Badge className="bg-green-600">مُنفذ</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded">
            <span>UI Access Control</span>
            <Badge className="bg-green-600">مُنفذ</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded">
            <span>Audit Logging</span>
            <Badge variant="outline">قيد التطوير</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-white dark:bg-card rounded">
            <span>Role Management UI</span>
            <Badge variant="outline">قيد التطوير</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
