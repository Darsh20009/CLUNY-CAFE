import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coffee, LogOut, ArrowLeft, ShoppingCart, ClipboardList, User, Award, ChefHat, Wallet, Warehouse, Eye, Calendar, FileText, BarChart3, Settings, Lock, Clock, Utensils } from "lucide-react";
import type { Employee } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export default function EmployeeHome() {
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const { t, i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      setEmployee(emp);
    } else {
      window.location.href = "/employee/gateway";
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    setLocation("/employee/gateway");
  };

  if (!employee) {
    return null;
  }

  const isManager = employee.role === "manager" || employee.role === "admin";

  const employeeQuickAccess = [
    {
      title: t('home.pos'),
      description: t('home.pos_desc'),
      icon: ShoppingCart,
      path: "/employee/pos",
      color: "from-green-500 to-green-600",
      testId: "button-pos"
    },
    {
      title: t('home.orders'),
      description: t('home.orders_desc'),
      icon: ClipboardList,
      path: "/employee/orders",
      color: "from-blue-500 to-blue-600",
      testId: "button-orders"
    },
    {
      title: t('home.attendance'),
      description: t('home.attendance_desc'),
      icon: Calendar,
      path: "/employee/attendance",
      color: "from-purple-500 to-purple-600",
      testId: "button-attendance"
    },
    {
      title: t('home.leave'),
      description: t('home.leave_desc'),
      icon: FileText,
      path: "/employee/leave-request",
      color: "from-orange-500 to-orange-600",
      testId: "button-leave"
    },
    {
      title: t('home.kitchen'),
      description: t('home.kitchen_desc'),
      icon: ChefHat,
      path: "/employee/kitchen",
      color: "from-red-500 to-red-600",
      testId: "button-kitchen"
    },
    {
      title: t('home.hr'),
      description: t('home.hr_desc'),
      icon: User,
      path: "/employee/dashboard",
      color: "from-indigo-500 to-indigo-600",
      testId: "button-hr"
    }
  ];

  const managerAccess = [
    {
      title: t('home.drinks_mgmt'),
      description: t('home.drinks_mgmt_desc'),
      icon: Coffee,
      path: "/employee/menu-management",
      color: "from-amber-500 to-amber-600",
      testId: "button-menu-mgmt"
    },
    {
      title: t('home.food_mgmt'),
      description: t('home.food_mgmt_desc'),
      icon: Utensils,
      path: "/employee/menu-management?type=food",
      color: "from-orange-500 to-orange-600",
      testId: "button-food-mgmt"
    },
    {
      title: t('home.ingredients'),
      description: t('home.ingredients_desc'),
      icon: Warehouse,
      path: "/employee/ingredients",
      color: "from-cyan-500 to-cyan-600",
      testId: "button-ingredients-mgmt"
    },
    {
      title: t('home.dashboard'),
      description: t('home.dashboard_desc'),
      icon: BarChart3,
      path: "/employee/dashboard",
      color: "from-teal-500 to-teal-600",
      testId: "button-dashboard"
    },
    {
      title: t('home.employees'),
      description: t('home.employees_desc'),
      icon: Lock,
      path: "/manager/employees",
      color: "from-pink-500 to-pink-600",
      testId: "button-employees"
    },
    {
      title: t('home.tables_res'),
      description: t('home.tables_res_desc'),
      icon: Eye,
      path: "/employee/tables",
      color: "from-lime-500 to-lime-600",
      testId: "button-tables"
    }
  ];

  return (
    <div className="min-h-screen pb-16 sm:pb-0 bg-gradient-to-br from-background via-primary/5 to-background" dir={dir}>
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-amber-500 to-amber-700 rounded-full flex items-center justify-center flex-shrink-0">
                <Coffee className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-accent">{t('home.control_panel')}</h1>
                <p className="text-gray-400 text-sm">{t('home.welcome', { name: employee.fullName })}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 sm:ml-2" />
              <span className="hidden sm:inline">{t('home.logout')}</span>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-[#2d1f1a] border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">{t('home.job_title')}</p>
                    <p className="text-white font-bold text-lg">{employee.jobTitle || employee.role}</p>
                  </div>
                  <Badge className="bg-primary/20 text-primary">
                    {employee.role === "manager" ? t('home.manager_label') : t('home.employee_label')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#2d1f1a] border-primary/20">
              <CardContent className="pt-6">
                <div>
                  <p className="text-gray-400 text-sm">{t('home.branch')}</p>
                  <p className="text-white font-bold text-lg">{employee.branchId || t('home.all_branches')}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#2d1f1a] border-primary/20">
              <CardContent className="pt-6">
                <div>
                  <p className="text-gray-400 text-sm">{t('home.employee_number')}</p>
                  <p className="text-white font-bold text-lg">{employee.id?.slice(0, 8)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-accent mb-6">{t('home.quick_access')}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employeeQuickAccess.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`bg-gradient-to-br ${item.color} hover:opacity-90 h-auto p-6 text-left justify-start rounded-xl`}
                  data-testid={item.testId}
                >
                  <div className="text-left w-full">
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="w-5 h-5" />
                      <span className="font-bold text-base">{item.title}</span>
                    </div>
                    <p className="text-white/80 text-xs ml-8">{item.description}</p>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        {isManager && (
          <div>
            <h2 className="text-2xl font-bold text-accent mb-6">{t('home.manager_permissions')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {managerAccess.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={`bg-gradient-to-br ${item.color} hover:opacity-90 h-auto p-6 text-left justify-start rounded-xl`}
                    data-testid={item.testId}
                  >
                    <div className="text-left w-full">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="w-5 h-5" />
                        <span className="font-bold text-base">{item.title}</span>
                      </div>
                      <p className="text-white/80 text-xs ml-8">{item.description}</p>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <MobileBottomNav employeeRole={employee?.role} onLogout={handleLogout} />
    </div>
  );
}
