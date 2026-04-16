import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Home, ClipboardList, CreditCard, LogOut, Menu, Languages } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { 
  Coffee, ChefHat, Users, Settings, BarChart3, Wallet, Warehouse, 
  Table, ShoppingCart, Calendar, FileText, Utensils, Eye 
} from "lucide-react";

interface MobileBottomNavProps {
  employeeRole?: string;
  onLogout?: () => void;
}

export function MobileBottomNav({ employeeRole, onLogout }: MobileBottomNavProps) {
  const [location] = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const { t, i18n } = useTranslation();

  const resolvedRole = employeeRole || (() => {
    try {
      const stored = localStorage.getItem("currentEmployee");
      if (stored) return JSON.parse(stored).role;
    } catch {}
    return '';
  })();

  const isManager = ['manager', 'owner', 'admin'].includes(resolvedRole || '');

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("currentEmployee");
      localStorage.removeItem("cluny-restore-key");
      window.location.href = "/employee/gateway";
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const allPages = [
    { path: "/employee/home", icon: Home, label: t('mobile_nav.home') },
    { path: "/employee/dashboard", icon: BarChart3, label: t('mobile_nav.dashboard') },
    { path: "/employee/pos", icon: CreditCard, label: t('mobile_nav.pos') },
    { path: "/employee/orders", icon: ClipboardList, label: t('mobile_nav.orders') },
    { path: "/employee/cashier", icon: ShoppingCart, label: t('mobile_nav.cashier') },
    { path: "/employee/kitchen", icon: ChefHat, label: t('mobile_nav.kitchen') },
    { path: "/employee/table-orders", icon: Table, label: t('mobile_nav.tables') },
    { path: "/employee/loyalty", icon: Users, label: t('mobile_nav.loyalty') },
    { path: "/employee/attendance", icon: Calendar, label: t('mobile_nav.attendance') },
    { path: "/employee/leave-request", icon: FileText, label: t('mobile_nav.leave') },
    ...(isManager ? [
      { path: "/employee/menu-management", icon: Coffee, label: t('mobile_nav.drinks') },
      { path: "/employee/menu-management?type=food", icon: Utensils, label: t('mobile_nav.food') },
      { path: "/admin/settings", icon: Settings, label: t('mobile_nav.settings') },
      { path: "/manager/accounting", icon: Wallet, label: t('mobile_nav.accounting') },
      { path: "/manager/inventory", icon: Warehouse, label: t('mobile_nav.inventory') },
    ] : []),
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background border-t shadow-lg">
      <div className="flex items-center justify-around px-1 py-1.5">
        <Link href="/employee/home">
          <button className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] ${location === '/employee/home' ? 'text-primary font-bold' : 'text-muted-foreground'}`} data-testid="mobile-nav-home">
            <Home className="h-5 w-5" />
            <span>{t('mobile_nav.home')}</span>
          </button>
        </Link>
        <Link href="/employee/orders">
          <button className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] ${location === '/employee/orders' ? 'text-primary font-bold' : 'text-muted-foreground'}`} data-testid="mobile-nav-orders">
            <ClipboardList className="h-5 w-5" />
            <span>{t('mobile_nav.orders')}</span>
          </button>
        </Link>
        <Link href="/employee/pos">
          <button className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] ${location === '/employee/pos' ? 'text-primary font-bold' : 'text-muted-foreground'}`} data-testid="mobile-nav-pos">
            <CreditCard className="h-5 w-5" />
            <span>{t('mobile_nav.pos')}</span>
          </button>
        </Link>
        
        <Sheet open={showMenu} onOpenChange={setShowMenu}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] text-muted-foreground" data-testid="mobile-nav-menu">
              <Menu className="h-5 w-5" />
              <span>{t('mobile_nav.more')}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col overflow-hidden p-0">
            <SheetHeader className="px-4 pt-4 pb-2 shrink-0">
              <SheetTitle>{t('mobile_nav.menu_title')}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto min-h-0 px-4">
              <div className="grid grid-cols-3 gap-3 py-2">
                {allPages.map((item) => {
                  const Icon = item.icon;
                  const fullPath = location + window.location.search;
                  const isActive = item.path.includes('?')
                    ? fullPath === item.path
                    : location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <button 
                        onClick={() => setShowMenu(false)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl w-full transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
                        data-testid={`mobile-menu-${item.path.split('/').pop()}`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-xs font-medium">{item.label}</span>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="border-t px-4 pt-4 pb-6 shrink-0 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={toggleLanguage}
                data-testid="mobile-menu-language"
              >
                <Languages className="h-4 w-4 mr-2" />
                {i18n.language === 'ar' ? 'English' : 'عربي'}
              </Button>
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleLogout}
                data-testid="mobile-menu-logout"
              >
                <LogOut className="h-4 w-4 ml-2" />
                {t('mobile_nav.logout')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
