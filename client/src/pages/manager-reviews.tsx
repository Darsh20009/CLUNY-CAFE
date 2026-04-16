import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Star, MessageSquare, Filter, Loader2, CheckCircle } from "lucide-react";

interface Review {
  _id: string;
  rating: number;
  comment: string;
  customerName: string;
  customerPhone: string;
  orderId: string;
  orderNumber: string;
  managerReply?: string;
  repliedAt?: string;
  branchId: string;
  createdAt: string;
  product?: { nameAr: string; nameEn: string; imageUrl?: string };
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  avgRating: number;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
      ))}
    </div>
  );
}

export default function ManagerReviewsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ratingFilter, setRatingFilter] = useState("all");
  const [replyDialog, setReplyDialog] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data, isLoading, refetch } = useQuery<ReviewsResponse>({
    queryKey: ["/api/reviews/all", ratingFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      return fetch(`/api/reviews/all?${params}`).then(r => r.json());
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      apiRequest("PATCH", `/api/reviews/${id}/reply`, { reply }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/all"] });
      setReplyDialog(null);
      setReplyText("");
      toast({ title: "تم إرسال الرد بنجاح" });
    },
    onError: () => toast({ title: "فشل إرسال الرد", variant: "destructive" }),
  });

  const reviews = data?.reviews || [];
  const avgRating = data?.avgRating || 0;

  const ratingCounts = [5,4,3,2,1].map(r => ({
    rating: r,
    count: reviews.filter(rev => rev.rating === r).length,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-card via-slate-800 to-slate-900" dir="rtl">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setLocation("/manager/dashboard")} className="text-slate-300 hover:text-white" data-testid="btn-back">
            <ArrowLeft className="w-4 h-4 ml-2" />العودة
          </Button>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-400" />تقييمات العملاء
          </h1>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-700 text-slate-300">
            تحديث
          </Button>
        </div>

        {/* Rating summary */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="text-5xl font-bold text-white">{avgRating.toFixed(1)}</p>
                <StarRating rating={Math.round(avgRating)} />
                <p className="text-slate-400 text-xs mt-1">{data?.total || 0} تقييم</p>
              </div>
              <div className="flex-1 space-y-1 min-w-[180px]">
                {ratingCounts.map(({ rating, count }) => {
                  const pct = (data?.total || 0) > 0 ? (count / (data?.total || 1)) * 100 : 0;
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs w-3">{rating}</span>
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-slate-400 text-xs w-6">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white" data-testid="select-rating-filter">
              <SelectValue placeholder="فلتر التقييم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="5">5 نجوم ⭐⭐⭐⭐⭐</SelectItem>
              <SelectItem value="4">4 نجوم ⭐⭐⭐⭐</SelectItem>
              <SelectItem value="3">3 نجوم ⭐⭐⭐</SelectItem>
              <SelectItem value="2">2 نجوم ⭐⭐</SelectItem>
              <SelectItem value="1">نجمة واحدة ⭐</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Star className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>لا توجد تقييمات بعد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review._id} className="bg-slate-800/50 border-slate-700" data-testid={`card-review-${review._id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-white font-medium">{review.customerName || 'عميل'}</p>
                      {review.customerPhone && <p className="text-slate-400 text-xs">{review.customerPhone}</p>}
                      <p className="text-slate-500 text-xs mt-0.5">
                        {review.orderNumber ? `طلب #${review.orderNumber}` : ''} · {new Date(review.createdAt).toLocaleDateString('ar-SA')}
                      </p>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="text-slate-300 text-sm mb-3 bg-card/50 p-3 rounded-lg">"{review.comment}"</p>
                  )}
                  {review.managerReply ? (
                    <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 text-xs font-medium">رد المدير</span>
                      </div>
                      <p className="text-slate-300 text-sm">{review.managerReply}</p>
                    </div>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { setReplyDialog(review); setReplyText(""); }}
                      className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-500"
                      data-testid={`btn-reply-${review._id}`}
                    >
                      <MessageSquare className="w-3 h-3 ml-2" />رد على التقييم
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reply Dialog */}
        <Dialog open={!!replyDialog} onOpenChange={o => !o && setReplyDialog(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-white">الرد على تقييم {replyDialog?.customerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {replyDialog?.comment && (
                <div className="bg-card/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-1">تقييم العميل:</p>
                  <StarRating rating={replyDialog.rating} />
                  <p className="text-slate-300 text-sm mt-1">"{replyDialog.comment}"</p>
                </div>
              )}
              <Textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="اكتب ردك هنا..."
                className="bg-slate-800 border-slate-700 text-white resize-none"
                rows={4}
                data-testid="textarea-reply"
              />
              <Button
                onClick={() => replyDialog && replyMutation.mutate({ id: replyDialog._id, reply: replyText })}
                disabled={!replyText.trim() || replyMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700"
                data-testid="btn-submit-reply"
              >
                {replyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                إرسال الرد
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
