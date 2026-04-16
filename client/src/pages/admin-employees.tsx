import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Plus, Search, Edit2, Trash2, ChevronDown, X, Download, Trash } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Employee {
  id: string;
  fullName: string;
  username: string;
  phone: string;
  jobTitle: string;
  role: string;
  isActivated: number;
  branchId?: string;
}

export default function AdminEmployees() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    phone: '',
    jobTitle: '',
    role: 'cashier',
    allowedPages: [] as string[],
    permissions: [] as string[],
  });

  const AVAILABLE_PAGES = [
    { id: 'pos', name: 'نقاط البيع' },
    { id: 'orders', name: 'الطلبات' },
    { id: 'inventory', name: 'المخزون' },
    { id: 'accounting', name: 'المحاسبة' },
    { id: 'settings', name: 'الإعدادات' },
    { id: 'delivery', name: 'التوصيل' },
    { id: 'reports', name: 'التقارير' },
  ];

  const PERMISSIONS = [
    { id: 'void_order', name: 'إلغاء الطلبات' },
    { id: 'give_discount', name: 'منح خصومات' },
    { id: 'open_drawer', name: 'فتح درج النقود' },
    { id: 'edit_inventory', name: 'تعديل المخزون' },
    { id: 'view_reports', name: 'عرض التقارير المالية' },
  ];

  const { data: employees = [], refetch } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create employee');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setShowAddForm(false);
      setFormData({ 
        fullName: '', 
        username: '', 
        phone: '', 
        jobTitle: '', 
        role: 'cashier',
        allowedPages: [],
        permissions: []
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update employee');
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setEditingId(null);
      setFormData({ 
        fullName: '', 
        username: '', 
        phone: '', 
        jobTitle: '', 
        role: 'cashier',
        allowedPages: [],
        permissions: []
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete employee');
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredEmployees = employees.filter((emp: Employee) => {
    const matchSearch = emp.fullName.includes(search) || emp.phone.includes(search) || emp.username.includes(search);
    const matchRole = roleFilter === 'all' || emp.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? emp.isActivated === 1 : emp.isActivated === 0);
    return matchSearch && matchRole && matchStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(new Set(filteredEmployees.map((emp: Employee) => emp.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const handleSelectEmployee = (id: string) => {
    const newSelected = new Set(selectedEmployees);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEmployees(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`هل تريد حذف ${selectedEmployees.size} موظف؟`)) return;
    for (const id of selectedEmployees) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedEmployees(new Set());
  };

  const handleExportCSV = () => {
    const headers = ['الاسم', 'رقم الهاتف', 'المسمى الوظيفي', 'الدور', 'الحالة'];
    const rows = filteredEmployees.map((emp: Employee) => [
      emp.fullName,
      emp.phone,
      emp.jobTitle,
      emp.role,
      emp.isActivated === 1 ? 'نشط' : 'معطل',
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach((row: string[]) => {
      csv += row.map((cell: string) => `"${cell}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة الموظفين</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات الموظفين والأدوار والصلاحيات</p>
        </div>
        <Button 
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingId(null);
            setFormData({ 
              fullName: '', 
              username: '', 
              phone: '', 
              jobTitle: '', 
              role: 'cashier',
              allowedPages: [],
              permissions: []
            });
          }}
          className="bg-accent hover:bg-accent"
          data-testid="button-add-employee"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة موظف
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <Card className="border-orange-200 dark:border-orange-900/30 bg-background dark:bg-accent/10">
          <CardHeader className="pb-4">
            <CardTitle>{editingId ? 'تعديل الموظف' : 'إضافة موظف جديد'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">الاسم الكامل</label>
                  <Input
                    placeholder="أحمد محمد"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    data-testid="input-fullname"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">اسم المستخدم</label>
                  <Input
                    placeholder="ahmed123"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    data-testid="input-username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
                  <Input
                    placeholder="0501234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    data-testid="input-phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">المسمى الوظيفي</label>
                  <Input
                    placeholder="كاشير"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    data-testid="input-jobtitle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الدور</label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cashier">كاشير</SelectItem>
                      <SelectItem value="barista">باريستا</SelectItem>
                      <SelectItem value="manager">مدير</SelectItem>
                      <SelectItem value="admin">مسؤول</SelectItem>
                      <SelectItem value="driver">سائق</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border">
                <div>
                  <label className="block text-sm font-bold mb-3 flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    الصفحات المسموحة
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_PAGES.map(page => (
                      <label key={page.id} className="flex items-center gap-2 p-2 hover:bg-background rounded cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.allowedPages?.includes(page.id)}
                          onChange={(e) => {
                            const pages = formData.allowedPages || [];
                            const newPages = e.target.checked 
                              ? [...pages, page.id] 
                              : pages.filter(p => p !== page.id);
                            setFormData({
                              ...formData,
                              allowedPages: newPages
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <span className="text-sm">{page.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-3 flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    صلاحيات خاصة
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {PERMISSIONS.map(perm => (
                      <label key={perm.id} className="flex items-center gap-2 p-2 hover:bg-background rounded cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.permissions?.includes(perm.id)}
                          onChange={(e) => {
                            const perms = formData.permissions || [];
                            const newPerms = e.target.checked 
                              ? [...perms, perm.id] 
                              : perms.filter(p => p !== perm.id);
                            setFormData({
                              ...formData,
                              permissions: newPerms
                            });
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                        />
                        <span className="text-sm">{perm.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-accent hover:bg-accent" data-testid="button-save-employee">
                  {editingId ? 'تحديث' : 'إضافة'}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                  }}
                  data-testid="button-cancel"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions & Filters */}
      {selectedEmployees.size > 0 && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-sm font-medium">{selectedEmployees.size} موظف مختار</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            data-testid="button-bulk-delete"
          >
            <Trash className="w-4 h-4 ml-2" />
            حذف المختارين
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ابحث برقم الهاتف أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-4"
            data-testid="input-search"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40" data-testid="select-role-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأدوار</SelectItem>
            <SelectItem value="cashier">كاشير</SelectItem>
            <SelectItem value="barista">باريستا</SelectItem>
            <SelectItem value="manager">مدير</SelectItem>
            <SelectItem value="driver">سائق</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">معطل</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={handleExportCSV}
          data-testid="button-export-csv"
        >
          <Download className="w-4 h-4 ml-2" />
          تصدير
        </Button>
      </div>

      {/* Employees Table */}
      <Card className="border-0 bg-white dark:bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            الموظفون ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-orange-200 dark:border-orange-900/30">
                    <th className="text-right p-4 font-semibold w-8">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.size === filteredEmployees.length && filteredEmployees.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4"
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="text-right p-4 font-semibold">الاسم</th>
                    <th className="text-right p-4 font-semibold">رقم الهاتف</th>
                    <th className="text-right p-4 font-semibold">المسمى الوظيفي</th>
                    <th className="text-right p-4 font-semibold">الدور</th>
                    <th className="text-right p-4 font-semibold">الحالة</th>
                    <th className="text-right p-4 font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp: Employee) => (
                    <tr key={emp.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.has(emp.id)}
                          onChange={() => handleSelectEmployee(emp.id)}
                          className="w-4 h-4"
                          data-testid={`checkbox-employee-${emp.id}`}
                        />
                      </td>
                      <td className="p-4 font-medium">{emp.fullName}</td>
                      <td className="p-4 text-muted-foreground">{emp.phone}</td>
                      <td className="p-4 text-muted-foreground">{emp.jobTitle}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {emp.role === 'cashier' ? 'كاشير' : emp.role === 'barista' ? 'باريستا' : emp.role === 'manager' ? 'مدير' : emp.role === 'driver' ? 'سائق' : emp.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          emp.isActivated === 1
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {emp.isActivated === 1 ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(emp.id);
                              setFormData({
                                fullName: emp.fullName,
                                username: emp.username,
                                phone: emp.phone,
                                jobTitle: emp.jobTitle,
                                role: emp.role,
                                allowedPages: (emp as any).allowedPages || [],
                                permissions: (emp as any).permissions || [],
                              });
                              setShowAddForm(false);
                            }}
                            data-testid={`button-edit-${emp.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => deleteMutation.mutate(emp.id)}
                            data-testid={`button-delete-${emp.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">لا توجد موظفون</h3>
              <p className="text-muted-foreground">ابدأ بإضافة موظف جديد</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
