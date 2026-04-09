import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { LoyaltyCard } from "@shared/schema";
import cardImageSrc from "@/assets/cluny_cafe_card.png";

interface LoyaltyCardProps {
  card: LoyaltyCard;
  showActions?: boolean;
  compact?: boolean;
}

export default function LoyaltyCardComponent({ card, showActions = true, compact = false }: LoyaltyCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const points = card.points || 0;
  const sarValue = (points * 0.02).toFixed(2);
  const sarFormatted = Number(sarValue).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pointsFormatted = points.toLocaleString("ar-SA");

  const phoneDisplay = (() => {
    const p = (card.phoneNumber || "").replace(/\D/g, "");
    const local = p.startsWith("966") ? p.slice(3) : p.slice(-9);
    if (local.length >= 9) {
      return `+966 ${local[0]} ${local.slice(1, 4)} ${local.slice(4, 9)}`;
    }
    return card.phoneNumber || "";
  })();

  useEffect(() => {
    if (card.qrToken) {
      const cardUrl = `https://cluny.ma3k.online/loyalty-verify?token=${card.qrToken}`;
      QRCode.toDataURL(cardUrl, { width: 400, margin: 2, errorCorrectionLevel: 'H' })
        .then(setQrDataUrl).catch(console.error);
    }
  }, [card.qrToken]);

  const downloadCard = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1000, H = 630;
    canvas.width = W;
    canvas.height = H;

    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";

    const doRender = () => {
      ctx.drawImage(bgImg, 0, 0, W, H);

      // Customer name
      ctx.save();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 32px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
      ctx.fillText(card.customerName || '', 56, H - 120);
      ctx.restore();

      // Phone
      ctx.save();
      ctx.fillStyle = '#333333';
      ctx.font = '24px Arial, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(phoneDisplay, 56, H - 80);
      ctx.restore();

      // Points label
      ctx.save();
      ctx.fillStyle = '#555555';
      ctx.font = '18px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('نقاطي', W - 56, H - 115);
      ctx.restore();

      // Points value
      ctx.save();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 48px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(pointsFormatted, W - 56, H - 70);
      ctx.restore();

      // SAR value
      ctx.save();
      ctx.fillStyle = '#555555';
      ctx.font = '18px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`${sarFormatted} ريال`, W - 56, H - 40);
      ctx.restore();

      const link = document.createElement('a');
      link.download = `cluny-card-${card.customerName || 'loyalty'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    bgImg.onload = doRender;
    bgImg.onerror = () => {
      ctx.fillStyle = '#b5c8d0';
      ctx.fillRect(0, 0, W, H);
      doRender();
    };
    bgImg.src = cardImageSrc;
  };

  if (compact) {
    return (
      <div
        className="relative overflow-hidden rounded-xl shadow-lg select-none max-w-xs mx-auto"
        style={{ aspectRatio: '1.586 / 1' }}
        data-testid="loyalty-card-compact"
      >
        <img
          src={cardImageSrc}
          alt="بطاقة كلوني"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 flex flex-col justify-end p-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold" style={{ color: '#555555' }}>بطاقة كلوني</p>
              <p className="text-sm font-bold truncate max-w-[130px]" style={{ color: '#1a1a1a' }} data-testid="text-customer-name-compact">
                {card.customerName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px]" style={{ color: '#555555' }}>نقاطي</p>
              <p className="text-lg font-black leading-tight" style={{ color: '#1a1a1a' }} data-testid="text-points-compact">{pointsFormatted}</p>
              <p className="text-[10px]" style={{ color: '#555555' }}>{sarFormatted} ر.س</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="loyalty-card">
      {/* Card with image background */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl select-none"
        style={{ aspectRatio: '1.586 / 1', minHeight: '200px' }}
      >
        <img
          src={cardImageSrc}
          alt="بطاقة كلوني"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Customer data overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          {/* Top row - empty (card image already has chip + logo) */}
          <div />

          {/* Bottom row - customer info */}
          <div className="flex items-end justify-between">
            <div>
              <p
                className="font-bold text-base leading-tight drop-shadow-md"
                style={{ color: '#1a1a1a' }}
                data-testid="text-customer-name"
              >
                {card.customerName}
              </p>
              <p
                className="font-mono text-sm mt-0.5"
                style={{ color: '#333333' }}
                data-testid="text-phone-display"
              >
                {phoneDisplay}
              </p>
            </div>

            <div className="text-right" dir="rtl">
              <p className="text-xs mb-0.5" style={{ color: '#555555' }}>نقاطي</p>
              <p
                className="font-black text-2xl leading-none"
                style={{ color: '#1a1a1a' }}
                data-testid="text-points"
              >
                {pointsFormatted}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
                {sarFormatted} ريال
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-primary">{pointsFormatted}</div>
          <div className="text-xs text-muted-foreground">نقطة متاحة</div>
          <div className="text-xs text-blue-600 font-medium mt-0.5">{sarFormatted} ر.س</div>
        </div>
        <div className="bg-card border rounded-xl p-3 text-center">
          <div className="text-2xl font-black text-muted-foreground">{card.discountCount || 0}</div>
          <div className="text-xs text-muted-foreground">مرة استخدام</div>
          <div className="text-xs text-muted-foreground mt-0.5">{(card.totalSpent || 0).toFixed(2)} ر.س</div>
        </div>
      </div>

      {showActions && (
        <Button onClick={downloadCard} variant="outline" className="w-full gap-2" data-testid="button-download-card">
          <Download className="w-4 h-4" />
          تحميل البطاقة
        </Button>
      )}
    </div>
  );
}
