import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Gift,
  Bell,
  Zap,
  MessageCircle,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useNotifications } from "@/hooks/use-notifications";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "order_update":
      return <Package className="w-5 h-5" />;
    case "referral":
      return <Gift className="w-5 h-5" />;
    case "loyalty":
      return <Zap className="w-5 h-5" />;
    case "promotion":
      return <MessageCircle className="w-5 h-5" />;
    default:
      return <Bell className="w-5 h-5" />;
  }
};

const getNotificationLabel = (type: string) => {
  switch (type) {
    case "order_update":
      return "تحديث الطلب";
    case "referral":
      return "الإحالات";
    case "loyalty":
      return "البرنامج الموالي";
    case "promotion":
      return "عروض ترويجية";
    default:
      return "نظام";
  }
};

export default function NotificationsPage() {
  const { sendNotification } = useNotifications();
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json();
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("PATCH", `/api/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/notifications/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/notifications/mark-all-read", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  if (isLoading) {
    return <div className="p-4">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">الإشعارات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount} إشعارات جديدة
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={() => markAllAsReadMutation.mutate()}
            variant="outline"
            size="sm"
            data-testid="button-mark-all-read"
          >
            <CheckCircle2 className="w-4 h-4 ml-2" />
            وضع علامة على الكل كمقروء
          </Button>
        )}
      </div>

      {notifications && notifications.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">لا توجد إشعارات حالياً</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications?.map((notification: any) => (
            <Card
              key={notification.id}
              className={`p-4 transition-colors ${
                !notification.isRead
                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  : ""
              }`}
              data-testid={`card-notification-${notification.id}`}
            >
              <div className="flex gap-4 items-start">
                <div className="text-blue-500 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div>
                      <h3 className="font-semibold">{notification.title}</h3>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full inline-block mt-1">
                        {getNotificationLabel(notification.type)}
                      </span>
                    </div>
                    {!notification.isRead && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full mt-2" />
                    )}
                  </div>
                  <p className="text-sm text-foreground my-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleDateString(
                      "ar-SA",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!notification.isRead && (
                    <Button
                      onClick={() => markAsReadMutation.mutate(notification.id)}
                      size="sm"
                      variant="ghost"
                      data-testid={`button-mark-read-${notification.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => deleteMutation.mutate(notification.id)}
                    size="sm"
                    variant="ghost"
                    className="text-red-500"
                    data-testid={`button-delete-${notification.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
