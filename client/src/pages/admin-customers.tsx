import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, Phone, Mail, Wallet, Award, Car } from "lucide-react";
import type { Customer } from "@shared/schema";

type AdminCustomer = Omit<Customer, "password"> & { _id?: string; id?: string };

function formatDate(value?: string | Date) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "-";
  }
}

export default function AdminCustomers() {
  const [search, setSearch] = useState("");

  const { data: customers = [], isLoading } = useQuery<AdminCustomer[]>({
    queryKey: ["/api/admin/customers"],
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const hay = `${c.name || ""} ${c.phone || ""} ${c.email || ""} ${c.plateNumber || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customers, search]);

  const stats = useMemo(() => {
    const total = customers.length;
    const totalPoints = customers.reduce((s, c) => s + (c.points || 0), 0);
    const totalWallet = customers.reduce((s, c) => s + (c.walletBalance || 0), 0);
    const cashierRegistered = customers.filter((c) => c.registeredBy === "cashier").length;
    return { total, totalPoints, totalWallet, cashierRegistered };
  }, [customers]);

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl" data-testid="page-admin-customers">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Users className="h-7 w-7 text-orange-600" />
          إدارة العملاء
        </h1>
        <p className="text-sm text-muted-foreground">
          عرض جميع العملاء المسجلين في النظام مع نقاط الولاء والمحافظ
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card data-testid="stat-total-customers">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي العملاء</p>
              <p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
        <Card data-testid="stat-total-points">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي النقاط</p>
              <p className="text-2xl font-bold" data-testid="text-stat-points">
                {stats.totalPoints.toLocaleString("ar-SA")}
              </p>
            </div>
            <Award className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card data-testid="stat-total-wallet">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الأرصدة</p>
              <p className="text-2xl font-bold" data-testid="text-stat-wallet">
                {stats.totalWallet.toFixed(2)} ر.س
              </p>
            </div>
            <Wallet className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card data-testid="stat-cashier-registered">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">مسجَّل من الكاشير</p>
              <p className="text-2xl font-bold" data-testid="text-stat-cashier">
                {stats.cashierRegistered}
              </p>
            </div>
            <Phone className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg">قائمة العملاء</CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="بحث بالاسم أو الجوال أو البريد أو لوحة السيارة"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
              data-testid="input-search-customers"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-customers">
              {customers.length === 0 ? "لا يوجد عملاء بعد" : "لا توجد نتائج مطابقة"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الجوال</TableHead>
                    <TableHead className="text-right">البريد</TableHead>
                    <TableHead className="text-right">النقاط</TableHead>
                    <TableHead className="text-right">المحفظة</TableHead>
                    <TableHead className="text-right">السيارة</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">تاريخ التسجيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const id = (c._id || c.id || c.phone) as string;
                    const car = [c.carType, c.carColor, c.plateNumber].filter(Boolean).join(" - ");
                    return (
                      <TableRow key={id} data-testid={`row-customer-${id}`}>
                        <TableCell className="font-semibold" data-testid={`text-name-${id}`}>
                          {c.name || "-"}
                        </TableCell>
                        <TableCell dir="ltr" className="text-right" data-testid={`text-phone-${id}`}>
                          {c.phone || "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground" data-testid={`text-email-${id}`}>
                          {c.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3.5 w-3.5" />
                              {c.email}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-points-${id}`}>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {(c.points || 0).toLocaleString("ar-SA")}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-wallet-${id}`}>
                          {(c.walletBalance || 0).toFixed(2)} ر.س
                        </TableCell>
                        <TableCell data-testid={`text-car-${id}`}>
                          {car ? (
                            <span className="inline-flex items-center gap-1 text-sm">
                              <Car className="h-3.5 w-3.5" />
                              {car}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-source-${id}`}>
                          {c.registeredBy === "cashier" ? (
                            <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">
                              من الكاشير
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-orange-300 text-orange-700 dark:text-orange-300">
                              تسجيل ذاتي
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm" data-testid={`text-created-${id}`}>
                          {formatDate(c.createdAt as any)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
