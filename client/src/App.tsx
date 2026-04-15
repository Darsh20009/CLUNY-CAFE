import "@/lib/i18n";
import { lazy, Suspense, useState, useEffect } from "react";
import { Router as WouterRouter, Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminLayout } from "@/components/admin-layout";
import SplashScreen from "@/pages/splash";
import CartModal from "@/components/cart-modal";
import CheckoutModal from "@/components/checkout-modal";
import { CartProvider, useCartStore } from "@/lib/cart-store";
import { CustomerProvider } from "@/contexts/CustomerContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { PWAUpdateNotifier } from "@/components/PWAUpdateNotifier";
import MenuPage from "@/pages/menu"; 
import CustomerProfile from "@/pages/customer-profile";
import CartPage from "@/pages/cart-page";
import { useTranslation } from "react-i18next";

const ProductDetails = lazy(() => import("@/pages/product-details"));
const PaymentReturnPage = lazy(() => import("@/pages/payment-return"));
const DeliverySelectionPage = lazy(() => import("@/pages/delivery-selection"));
const DeliveryMapPage = lazy(() => import("@/pages/delivery-map"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const OrderTrackingPage = lazy(() => import("@/pages/tracking"));
const EmployeeSplash = lazy(() => import("@/pages/employee-splash"));
const EmployeeGateway = lazy(() => import("@/pages/employee-gateway"));
const EmployeeLogin = lazy(() => import("@/pages/employee-login"));
const EmployeeDashboard = lazy(() => import("@/pages/employee-dashboard"));
const EmployeeCashier = lazy(() => import("@/pages/employee-cashier"));
const EmployeeOrders = lazy(() => import("@/pages/employee-orders"));
const EmployeeLoyalty = lazy(() => import("@/pages/employee-loyalty"));
const EmployeeMenuManagement = lazy(() => import("@/pages/employee-menu-management"));
const EmployeeIngredientsManagement = lazy(() => import("@/pages/employee-ingredients-management"));
const EmployeeOrdersDisplay = lazy(() => import("@/pages/employee-orders-display"));
const UnifiedHub = lazy(() => import("@/pages/unified-hub"));
const MyCard = lazy(() => import("@/pages/my-card"));
const CustomerLogin = lazy(() => import("@/pages/customer-login"));
const CustomerAuth = lazy(() => import("@/pages/CustomerAuth"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const CopyCard = lazy(() => import("@/pages/CopyCard"));
const CardCustomization = lazy(() => import("@/pages/card-customization"));
const MyOrdersPage = lazy(() => import("@/pages/my-orders"));
const MyOffers = lazy(() => import("@/pages/my-offers"));
const ManagerEmployees = lazy(() => import("@/pages/manager-employees"));
const EmployeeActivation = lazy(() => import("@/pages/employee-activation"));
const ManagerDashboard = lazy(() => import("@/pages/manager-dashboard"));
const ManagerLogin = lazy(() => import("@/pages/manager-login"));
const ManagerDrivers = lazy(() => import("@/pages/manager-drivers"));
const ManagerTables = lazy(() => import("@/pages/manager-tables"));
const TableMenu = lazy(() => import("@/pages/table-menu"));
const TableCheckout = lazy(() => import("@/pages/table-checkout"));
const TableOrderTracking = lazy(() => import("@/pages/table-order-tracking"));
const TableReservation = lazy(() => import("@/pages/table-reservation"));
const CashierTableOrders = lazy(() => import("@/pages/cashier-table-orders"));
const CashierTables = lazy(() => import("@/pages/cashier-tables"));
const CashierReservations = lazy(() => import("@/pages/cashier-reservations"));
const EmployeeForgotPassword = lazy(() => import("@/pages/employee-forgot-password"));
const ManagerForgotPassword = lazy(() => import("@/pages/manager-forgot-password"));
const EmployeeAttendance = lazy(() => import("@/pages/employee-attendance"));
const LeaveRequestPage = lazy(() => import("@/pages/leave-request"));
const ManagerAttendance = lazy(() => import("@/pages/manager-attendance"));
const OwnerDashboard = lazy(() => import("@/pages/owner-dashboard"));
const InventoryDashboard = lazy(() => import("@/pages/inventory-dashboard"));
const InventoryRawItems = lazy(() => import("@/pages/inventory-raw-items"));
const InventorySuppliers = lazy(() => import("@/pages/inventory-suppliers"));
const InventoryPurchases = lazy(() => import("@/pages/inventory-purchases"));
const InventoryRecipes = lazy(() => import("@/pages/inventory-recipes"));
const InventoryStock = lazy(() => import("@/pages/inventory-stock"));
const InventoryAlerts = lazy(() => import("@/pages/inventory-alerts"));
const InventoryMovements = lazy(() => import("@/pages/inventory-movements"));
const POSSystem = lazy(() => import("@/pages/pos-system"));
const KitchenDisplay = lazy(() => import("@/pages/kitchen-display"));
const AccountingDashboard = lazy(() => import("@/pages/accounting-dashboard"));
const IngredientsRecipesInventory = lazy(() => import("@/pages/ingredients-recipes-inventory"));
const OrderStatusDisplay = lazy(() => import("@/pages/order-status-display"));
const CustomerDisplay = lazy(() => import("@/pages/customer-display"));
const InventorySmartPage = lazy(() => import("@/pages/inventory-smart"));
const AccountingSmartPage = lazy(() => import("@/pages/accounting-smart"));
const EmployeeAvailability = lazy(() => import("@/pages/employee-availability"));
const UnauthorizedPage = lazy(() => import("@/pages/unauthorized"));
const ProductReviews = lazy(() => import("@/pages/product-reviews"));
const ReferralProgram = lazy(() => import("@/pages/referral-program"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const AdminNotificationsPage = lazy(() => import("@/pages/admin-notifications"));
const CustomerReservations = lazy(() => import("@/pages/customer-reservations"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminEmployees = lazy(() => import("@/pages/admin-employees"));
const AdminReports = lazy(() => import("@/pages/admin-reports"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const AdminBranches = lazy(() => import("@/pages/admin-branches"));
const AdminEmail = lazy(() => import("@/pages/admin-email"));
const AdminAppPublishing = lazy(() => import("@/pages/admin-app-publishing"));
const AdminApplePayHealth = lazy(() => import("@/pages/admin-apple-pay-health"));
const TenantSignup = lazy(() => import("@/pages/tenant-signup"));
const RecipesManagement = lazy(() => import("@/pages/recipes-management"));
const InventorySmartDashboard = lazy(() => import("@/pages/inventory-smart-dashboard"));
const AccountingSmartDashboard = lazy(() => import("@/pages/accounting-smart-dashboard"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const StockMovementsPage = lazy(() => import("@/pages/stock-movements"));

const OSInventoryManagement = lazy(() => import("@/pages/os-inventory-management"));
const OSRecipeManagement = lazy(() => import("@/pages/os-recipe-management"));
const OSAccountingDashboard = lazy(() => import("@/pages/os-accounting-dashboard"));
const OSStockManagement = lazy(() => import("@/pages/os-stock-management"));
const OSRolesManagement = lazy(() => import("@/pages/os-roles-management"));
const ExecutiveDashboard = lazy(() => import("@/pages/executive-dashboard"));
const UnifiedInventoryRecipes = lazy(() => import("@/pages/unified-inventory-recipes"));
const ZATCAInvoices = lazy(() => import("@/pages/zatca-invoices"));
const MenuView = lazy(() => import("@/pages/menu-view"));
const ErpAccountingPage = lazy(() => import("@/pages/erp-accounting"));
const UserGuide = lazy(() => import("@/pages/user-guide"));
const AdvancedAnalytics = lazy(() => import("@/pages/advanced-analytics"));
const GiftCardsManagement = lazy(() => import("@/pages/gift-cards-management"));
const PayrollManagement = lazy(() => import("@/pages/payroll-management"));
const ManagerReviews = lazy(() => import("@/pages/manager-reviews"));
const SupplierManagement = lazy(() => import("@/pages/supplier-management"));
const LoyaltyProgram = lazy(() => import("@/pages/loyalty-program"));
const ExternalIntegrations = lazy(() => import("@/pages/external-integrations"));
const WarehouseManagement = lazy(() => import("@/pages/warehouse-management"));
const SupportSystem = lazy(() => import("@/pages/support-system"));
const StockOrganizationDashboard = lazy(() => import("@/pages/stock-organization-dashboard"));
const DeliveryServiceStatus = lazy(() => import("@/pages/delivery-service-status"));
const DriverPortal = lazy(() => import("@/pages/driver-portal"));
const DriverLogin = lazy(() => import("@/pages/driver-login"));
const DeliveryTracking = lazy(() => import("@/pages/delivery-tracking"));
const WelcomePage = lazy(() => import("@/pages/welcome"));
const EmployeeHome = lazy(() => import("@/pages/employee-home"));
import clunyLogoCustomer from "@assets/cluny-logo-customer.png";
import clunyLogoStaff from "@assets/cluny-logo-staff.png";

const PageLoader = () => {
  const isEmployee = window.location.pathname.startsWith('/employee') || 
                     window.location.pathname.startsWith('/manager') ||
                     window.location.pathname.startsWith('/admin') ||
                     window.location.pathname === '/0';
  
  return (
    <div className="w-full h-screen flex items-center justify-center bg-[#F7F8F8] dark:bg-[#1a1410]">
      <div className="flex flex-col items-center gap-4">
        {isEmployee ? (
          <img src={clunyLogoStaff} alt="CLUNY SYSTEMS" className="w-16 h-16 object-contain rounded-xl animate-pulse" />
        ) : (
          <img src={clunyLogoCustomer} alt="CLUNY CAFE" className="w-16 h-16 object-contain rounded-xl animate-pulse" />
        )}
        <p className="text-[#9FB2B3] font-medium animate-pulse font-ibm-arabic">جاري التحميل...</p>
      </div>
    </div>
  );
};

const MaintenancePage = lazy(() => import("@/pages/maintenance"));

function AppRouter() {
  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  if (businessConfig?.isMaintenanceMode && !window.location.pathname.startsWith('/employee') && !window.location.pathname.startsWith('/manager') && !window.location.pathname.startsWith('/admin')) {
    return <MaintenancePage reason={businessConfig.maintenanceReason} />;
  }

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/welcome"><WelcomePage /></Route>
      <Route path="/" component={WelcomePage} />
      <Route path="/0"><EmployeeSplash /></Route>
      <Route path="/tenant/signup"><TenantSignup /></Route>
      <Route path="/customer-login">
        <CustomerLogin />
      </Route>
      <Route path="/auth">
        <CustomerAuth />
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/menu">
        <MenuPage />
      </Route>
      <Route path="/menu-view">
        <MenuView />
      </Route>
      <Route path="/product/:id">
        <ProductDetails />
      </Route>
      <Route path="/table-menu/:qrToken">
        <TableMenu />
      </Route>
      <Route path="/table-checkout/:tableId/:tableNumber">
        <TableCheckout />
      </Route>
      <Route path="/table-reservation">
        <TableReservation />
      </Route>
      <Route path="/my-reservations">
        <CustomerReservations />
      </Route>
      <Route path="/table-order-tracking/:orderId">
        <TableOrderTracking />
      </Route>
      <Route path="/order-status">
        <OrderStatusDisplay />
      </Route>
      <Route path="/customer-display">
        <CustomerDisplay />
      </Route>
      <Route path="/unauthorized">
        <UnauthorizedPage />
      </Route>

      {/* Notifications - for all users */}
      <Route path="/notifications"><NotificationsPage /></Route>
      <Route path="/admin/notifications"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminNotificationsPage /></AdminLayout></AuthGuard></Route>

      {/* Customer protected routes */}
      <Route path="/copy-card"><AuthGuard userType="customer"><CopyCard /></AuthGuard></Route>
      <Route path="/card-customization"><AuthGuard userType="customer"><CardCustomization /></AuthGuard></Route>
      <Route path="/my-orders"><AuthGuard userType="customer"><MyOrdersPage /></AuthGuard></Route>
      <Route path="/my-offers"><AuthGuard userType="customer"><MyOffers /></AuthGuard></Route>
      <Route path="/my-card"><AuthGuard userType="customer"><MyCard /></AuthGuard></Route>
      <Route path="/referrals"><AuthGuard userType="customer"><ReferralProgram /></AuthGuard></Route>
      <Route path="/cart"><AuthGuard userType="customer"><CartPage /></AuthGuard></Route>
      <Route path="/delivery"><AuthGuard userType="customer"><DeliverySelectionPage /></AuthGuard></Route>
      <Route path="/delivery/map"><AuthGuard userType="customer"><DeliveryMapPage /></AuthGuard></Route>
      <Route path="/checkout"><AuthGuard userType="customer"><CheckoutPage /></AuthGuard></Route>
      <Route path="/tracking"><AuthGuard userType="customer"><OrderTrackingPage /></AuthGuard></Route>
      <Route path="/payment-return"><PaymentReturnPage /></Route>
      <Route path="/profile"><AuthGuard userType="customer"><CustomerProfile /></AuthGuard></Route>

      {/* Employee auth routes (public) */}
      <Route path="/employee"><EmployeeSplash /></Route>
      <Route path="/employee/home">{() => <AuthGuard userType="employee"><EmployeeHome /></AuthGuard>}</Route>
      <Route path="/employee/gateway"><EmployeeGateway /></Route>
      <Route path="/employee/login"><EmployeeLogin /></Route>
      <Route path="/employee/forgot-password"><EmployeeForgotPassword /></Route>
      <Route path="/employee/activate"><EmployeeActivation /></Route>

      {/* Employee protected routes */}
      <Route path="/employee/dashboard"><AuthGuard userType="employee"><EmployeeDashboard /></AuthGuard></Route>
      <Route path="/employee/cashier"><AuthGuard userType="employee"><EmployeeCashier /></AuthGuard></Route>
      <Route path="/employee/pos"><AuthGuard userType="employee"><POSSystem /></AuthGuard></Route>
      <Route path="/employee/kitchen"><AuthGuard userType="employee"><KitchenDisplay /></AuthGuard></Route>
      <Route path="/employee/tables"><AuthGuard userType="employee"><CashierTables /></AuthGuard></Route>
      <Route path="/employee/table-orders"><AuthGuard userType="employee"><CashierTableOrders /></AuthGuard></Route>
      <Route path="/employee/orders"><AuthGuard userType="employee"><EmployeeOrders /></AuthGuard></Route>
      <Route path="/employee/orders-display"><AuthGuard userType="employee"><EmployeeOrdersDisplay /></AuthGuard></Route>
      <Route path="/employee/loyalty"><AuthGuard userType="employee"><EmployeeLoyalty /></AuthGuard></Route>
      <Route path="/employee/menu-management"><AuthGuard userType="employee" allowedRoles={["manager", "admin"]}><EmployeeMenuManagement /></AuthGuard></Route>
      <Route path="/employee/ingredients"><AuthGuard userType="employee" allowedRoles={["manager", "admin"]}><EmployeeIngredientsManagement /></AuthGuard></Route>
      <Route path="/employee/availability"><AuthGuard userType="employee"><EmployeeAvailability /></AuthGuard></Route>
      <Route path="/employee/attendance"><AuthGuard userType="employee"><EmployeeAttendance /></AuthGuard></Route>
      <Route path="/employee/leave-request"><AuthGuard userType="employee"><LeaveRequestPage /></AuthGuard></Route>
      <Route path="/employee/reservations"><AuthGuard userType="employee"><CashierReservations /></AuthGuard></Route>

      {/* Manager auth routes (public) */}
      <Route path="/manager"><ManagerLogin /></Route>
      <Route path="/manager/forgot-password"><ManagerForgotPassword /></Route>
      <Route path="/manager/login"><ManagerLogin /></Route>

      {/* Manager protected routes */}
      <Route path="/manager/employees"><AuthGuard userType="employee" allowedRoles={["manager", "admin", "owner"]}><ManagerEmployees /></AuthGuard></Route>
      <Route path="/manager/drivers"><AuthGuard userType="manager"><ManagerDrivers /></AuthGuard></Route>
      <Route path="/manager/dashboard"><AuthGuard userType="manager"><ManagerDashboard /></AuthGuard></Route>
      <Route path="/manager/tables"><AuthGuard userType="manager"><ManagerTables /></AuthGuard></Route>
      <Route path="/manager/attendance"><AuthGuard userType="manager"><ManagerAttendance /></AuthGuard></Route>
      <Route path="/manager/inventory"><AuthGuard userType="manager"><InventorySmartPage /></AuthGuard></Route>
      <Route path="/manager/inventory/raw-items"><AuthGuard userType="manager"><InventoryRawItems /></AuthGuard></Route>
      <Route path="/manager/inventory/suppliers"><AuthGuard userType="manager"><InventorySuppliers /></AuthGuard></Route>
      <Route path="/manager/inventory/purchases"><AuthGuard userType="manager"><InventoryPurchases /></AuthGuard></Route>
      <Route path="/manager/inventory/recipes"><AuthGuard userType="manager"><InventoryRecipes /></AuthGuard></Route>
      <Route path="/manager/inventory/stock"><AuthGuard userType="manager"><InventoryStock /></AuthGuard></Route>
      <Route path="/manager/inventory/alerts"><AuthGuard userType="manager"><InventoryAlerts /></AuthGuard></Route>
      <Route path="/manager/inventory/movements"><AuthGuard userType="manager"><InventoryMovements /></AuthGuard></Route>
      <Route path="/manager/accounting"><AuthGuard userType="manager"><AccountingDashboard /></AuthGuard></Route>
      <Route path="/manager/inventory/smart"><AuthGuard userType="manager"><InventorySmartPage /></AuthGuard></Route>
      <Route path="/manager/accounting/smart"><AuthGuard userType="manager"><AccountingSmartPage /></AuthGuard></Route>
      <Route path="/manager/ingredients-recipes"><AuthGuard userType="manager"><IngredientsRecipesInventory /></AuthGuard></Route>
      <Route path="/manager/os-inventory"><AuthGuard userType="manager"><OSInventoryManagement /></AuthGuard></Route>
      <Route path="/manager/unified-inventory"><AuthGuard userType="manager"><UnifiedInventoryRecipes /></AuthGuard></Route>
      <Route path="/manager/zatca"><AuthGuard userType="manager"><ZATCAInvoices /></AuthGuard></Route>
      <Route path="/manager/guide"><AuthGuard userType="manager"><UserGuide /></AuthGuard></Route>
      <Route path="/guide"><UserGuide /></Route>
      <Route path="/manager/analytics"><AuthGuard userType="manager"><AdvancedAnalytics /></AuthGuard></Route>
      <Route path="/manager/gift-cards"><AuthGuard userType="manager"><GiftCardsManagement /></AuthGuard></Route>
      <Route path="/manager/payroll"><AuthGuard userType="manager"><PayrollManagement /></AuthGuard></Route>
      <Route path="/manager/reviews"><AuthGuard userType="manager"><ManagerReviews /></AuthGuard></Route>
      <Route path="/manager/suppliers"><AuthGuard userType="manager"><SupplierManagement /></AuthGuard></Route>
      <Route path="/manager/loyalty"><AuthGuard userType="manager"><LoyaltyProgram /></AuthGuard></Route>
      <Route path="/manager/integrations"><AuthGuard userType="manager"><ExternalIntegrations /></AuthGuard></Route>
      <Route path="/manager/warehouse"><AuthGuard userType="manager"><WarehouseManagement /></AuthGuard></Route>
      <Route path="/manager/support"><AuthGuard userType="manager"><SupportSystem /></AuthGuard></Route>
      <Route path="/manager/inventory/stock-organization"><AuthGuard userType="manager"><StockOrganizationDashboard /></AuthGuard></Route>
      <Route path="/manager/delivery-services"><AuthGuard userType="manager"><DeliveryServiceStatus /></AuthGuard></Route>
      <Route path="/manager/os-recipes"><AuthGuard userType="manager"><OSRecipeManagement /></AuthGuard></Route>
      <Route path="/manager/os-accounting"><AuthGuard userType="manager"><OSAccountingDashboard /></AuthGuard></Route>
      <Route path="/manager/os-stock"><AuthGuard userType="manager"><OSStockManagement /></AuthGuard></Route>
      <Route path="/manager/os-roles"><AuthGuard userType="manager" allowedRoles={["owner", "admin"]}><OSRolesManagement /></AuthGuard></Route>

      {/* Owner protected routes */}
      <Route path="/owner/dashboard"><AuthGuard userType="manager" allowedRoles={["owner", "admin"]}><OwnerDashboard /></AuthGuard></Route>
      <Route path="/executive"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><ExecutiveDashboard /></AuthGuard></Route>

      {/* Admin protected routes */}
      <Route path="/admin/dashboard"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminDashboard /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/employees"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminEmployees /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/reports"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminReports /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/settings"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminSettings /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/branches"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminBranches /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/email"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminEmail /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/apple-pay-health"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminApplePayHealth /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/app-publishing"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminAppPublishing /></AdminLayout></AuthGuard></Route>

      {/* Phase 5 - New Dashboard Pages */}
      <Route path="/recipes/management"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><RecipesManagement /></AuthGuard></Route>
      <Route path="/inventory/dashboard"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><InventorySmartDashboard /></AuthGuard></Route>
      <Route path="/accounting/dashboard"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AccountingSmartDashboard /></AuthGuard></Route>
      <Route path="/reports"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><ReportsPage /></AuthGuard></Route>
      <Route path="/stock-movements"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><StockMovementsPage /></AuthGuard></Route>

      {/* ERP Accounting System */}
      <Route path="/erp/accounting"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><ErpAccountingPage /></AuthGuard></Route>


      {/* Driver Portal routes */}
      <Route path="/driver/login"><DriverLogin /></Route>
      <Route path="/driver/portal"><DriverPortal /></Route>

      {/* Customer Delivery Tracking */}
      <Route path="/delivery/track/:orderId"><DeliveryTracking /></Route>
      <Route component={MenuPage} />
    </Switch>
  );
}

function AppContent() {
  const cartStore = useCartStore();
  const isCartOpen = cartStore?.isCartOpen;
  const isCheckoutOpen = cartStore?.isCheckoutOpen;

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <AppRouter />
      </Suspense>
      {/* Modals inside Router to ensure they can use routing hooks if needed */}
      {isCartOpen && <CartModal />}
      {isCheckoutOpen && <CheckoutModal />}
      <Toaster />
    </>
  );
}

function App() {
  const [isEmployee, setIsEmployee] = useState(false);
  const { i18n } = useTranslation();

  useEffect(() => {
    const employeePaths = ['/employee', '/manager', '/kitchen', '/pos', '/cashier', '/admin', '/owner', '/executive', '/0'];
    const currentPath = window.location.pathname;
    const isEmployeePath = employeePaths.some(path => currentPath === path || currentPath.startsWith(path + '/'));
    setIsEmployee(isEmployeePath);

    // Dynamic Manifest switching for PWA
    const manifestTag = document.getElementById('main-manifest') as HTMLLinkElement;
    if (manifestTag) {
      manifestTag.href = isEmployeePath ? '/employee-manifest.json' : '/manifest.json';
    }

    // Update document language and direction based on i18n language
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;

    // Redirect employee from customer root if they are on employee system
    if (isEmployeePath && currentPath === '/') {
      window.location.href = '/employee';
    }
  }, [i18n.language]);

  return (
    <div className={`${isEmployee ? 'employee-portal' : 'customer-portal'} min-h-screen bg-background text-foreground font-ibm-arabic antialiased`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} key={i18n.language}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CustomerProvider>
            <CartProvider>
              <ErrorBoundary>
                <WouterRouter>
                  <AppContent />
                </WouterRouter>
                <PWAUpdateNotifier />
              </ErrorBoundary>
            </CartProvider>
          </CustomerProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
