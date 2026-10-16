import "./_group.css";
import AdminDashboardSource from "./_shared/AdminDashboardSource";

export function Current() {
  return (
    <div className="cluny-dashboard-preview min-h-screen">
      <AdminDashboardSource />
      <div className="mock-data-flag">معاينة ببيانات تجريبية</div>
    </div>
  );
}
