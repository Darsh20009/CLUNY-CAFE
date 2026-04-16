import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import clunyLogo from "@assets/cluny-logo-customer.png";

interface TableQRCardProps {
  tableNumber: string;
  qrToken: string;
  branchName: string;
  tableUrl: string;
}

const BRAND = {
  sage: "#9FB2B3",
  sageDark: "#7A9B9C",
  sageLight: "#C5D4D5",
  sagePale: "#E8F0F0",
  white: "#FFFFFF",
  offWhite: "#F7FAFA",
  teal: "#2D9B6E",
  tealDark: "#1E7A54",
  textDark: "#3A5A5B",
  textMuted: "#6B8E8F",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLeafDecoration(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(size * 0.3, -size * 0.6, size * 0.8, -size * 0.5, size, 0);
  ctx.bezierCurveTo(size * 0.8, size * 0.5, size * 0.3, size * 0.6, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawArcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, radius: number, startAngle: number, isTop: boolean) {
  ctx.save();
  const totalAngle = text.length * 0.09;
  let angle = isTop ? startAngle - totalAngle / 2 : startAngle + totalAngle / 2;
  const direction = isTop ? 1 : -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.save();
    ctx.translate(
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle)
    );
    ctx.rotate(angle + (isTop ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(char, 0, 0);
    ctx.restore();
    angle += direction * 0.09;
  }
  ctx.restore();
}

export function TableQRCard({ tableNumber, qrToken, branchName, tableUrl }: TableQRCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQRCard = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = 1000;
      const height = 1400;
      canvas.width = width;
      canvas.height = height;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, BRAND.offWhite);
      bgGrad.addColorStop(0.3, BRAND.white);
      bgGrad.addColorStop(0.7, BRAND.white);
      bgGrad.addColorStop(1, BRAND.sagePale);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const topBarH = 20;
      const topGrad = ctx.createLinearGradient(0, 0, width, 0);
      topGrad.addColorStop(0, BRAND.sage);
      topGrad.addColorStop(0.3, BRAND.teal);
      topGrad.addColorStop(0.7, BRAND.teal);
      topGrad.addColorStop(1, BRAND.sage);
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, topBarH);

      ctx.fillStyle = topGrad;
      ctx.fillRect(0, height - topBarH, width, topBarH);

      ctx.strokeStyle = BRAND.sageLight;
      ctx.lineWidth = 2;
      roundRect(ctx, 40, 40, width - 80, height - 80, 20);
      ctx.stroke();

      ctx.strokeStyle = BRAND.sagePale;
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 6]);
      roundRect(ctx, 55, 55, width - 110, height - 110, 16);
      ctx.stroke();
      ctx.setLineDash([]);

      const leafColor = BRAND.sageLight + "80";
      drawLeafDecoration(ctx, 80, 80, 40, -0.5, leafColor);
      drawLeafDecoration(ctx, 920, 80, 40, 2.2, leafColor);
      drawLeafDecoration(ctx, 80, height - 80, 40, 0.5, leafColor);
      drawLeafDecoration(ctx, 920, height - 80, 40, -2.2, leafColor);

      drawLeafDecoration(ctx, 120, 95, 25, 0.3, leafColor);
      drawLeafDecoration(ctx, 880, 95, 25, 2.8, leafColor);
      drawLeafDecoration(ctx, 120, height - 95, 25, -0.3, leafColor);
      drawLeafDecoration(ctx, 880, height - 95, 25, -2.8, leafColor);

      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";

      const drawAfterLogo = (logoLoaded: boolean) => {
        const logoCenterX = width / 2;
        const logoCenterY = 190;
        const logoOuterR = 95;

        if (logoLoaded && logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(logoCenterX, logoCenterY, logoOuterR - 4, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          const imgSize = (logoOuterR - 4) * 2;
          ctx.drawImage(logoImg, logoCenterX - imgSize / 2, logoCenterY - imgSize / 2, imgSize, imgSize);
          ctx.restore();

          ctx.strokeStyle = BRAND.sage;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(logoCenterX, logoCenterY, logoOuterR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = BRAND.sageLight;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(logoCenterX, logoCenterY, logoOuterR + 8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const logoGrad = ctx.createRadialGradient(logoCenterX, logoCenterY, 0, logoCenterX, logoCenterY, logoOuterR);
          logoGrad.addColorStop(0, BRAND.sage);
          logoGrad.addColorStop(1, BRAND.sageDark);
          ctx.fillStyle = logoGrad;
          ctx.beginPath();
          ctx.arc(logoCenterX, logoCenterY, logoOuterR, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = BRAND.sageLight;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(logoCenterX, logoCenterY, logoOuterR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = BRAND.white;
          ctx.font = "bold 42px 'Georgia', serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("CLUNY", logoCenterX, logoCenterY);

          ctx.font = "16px 'Georgia', serif";
          ctx.fillStyle = BRAND.white;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          drawArcText(ctx, "C L U N Y   C A F E", logoCenterX, logoCenterY, logoOuterR - 18, -Math.PI / 2, true);
          drawArcText(ctx, "C L U N Y   C A F E", logoCenterX, logoCenterY, logoOuterR - 18, Math.PI / 2, false);
        }

        ctx.fillStyle = BRAND.textDark;
        ctx.font = "bold 54px 'Georgia', 'Playfair Display', serif";
        ctx.textAlign = "center";
        ctx.fillText("CLUNY CAFE", width / 2, 340);

        ctx.strokeStyle = BRAND.sage;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(250, 375);
        ctx.lineTo(width / 2 - 30, 375);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(width / 2 + 30, 375);
        ctx.lineTo(width - 250, 375);
        ctx.stroke();

        ctx.fillStyle = BRAND.teal;
        ctx.beginPath();
        ctx.arc(width / 2, 375, 6, 0, Math.PI * 2);
        ctx.fill();

        drawLeafDecoration(ctx, width / 2 - 40, 375, 18, Math.PI + 0.3, BRAND.sageLight);
        drawLeafDecoration(ctx, width / 2 + 40, 375, 18, -0.3, BRAND.sageLight);

        const tableY = 420;
        const tableH = 170;
        const tableW = 500;
        const tableX = (width - tableW) / 2;

        const tableBg = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY + tableH);
        tableBg.addColorStop(0, BRAND.sagePale);
        tableBg.addColorStop(0.5, BRAND.offWhite);
        tableBg.addColorStop(1, BRAND.sagePale);
        ctx.fillStyle = tableBg;
        roundRect(ctx, tableX, tableY, tableW, tableH, 16);
        ctx.fill();

        ctx.strokeStyle = BRAND.sage;
        ctx.lineWidth = 2;
        roundRect(ctx, tableX, tableY, tableW, tableH, 16);
        ctx.stroke();

        const tableAccentGrad = ctx.createLinearGradient(tableX, tableY, tableX + tableW, tableY);
        tableAccentGrad.addColorStop(0, "transparent");
        tableAccentGrad.addColorStop(0.2, BRAND.teal);
        tableAccentGrad.addColorStop(0.8, BRAND.teal);
        tableAccentGrad.addColorStop(1, "transparent");
        ctx.fillStyle = tableAccentGrad;
        roundRect(ctx, tableX, tableY, tableW, 5, 16);
        ctx.fill();

        ctx.fillStyle = BRAND.textMuted;
        ctx.font = "26px 'Segoe UI', Cairo, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("الطاولة رقم", width / 2, tableY + 50);

        ctx.fillStyle = BRAND.tealDark;
        ctx.font = "bold 120px 'Georgia', serif";
        ctx.textAlign = "center";
        ctx.fillText(tableNumber, width / 2, tableY + 145);

        drawQRSection(ctx, width, tableUrl);
      };

      logoImg.onload = () => drawAfterLogo(true);
      logoImg.onerror = () => drawAfterLogo(false);
      logoImg.src = clunyLogo;

      const drawQRSection = async (ctx: CanvasRenderingContext2D, width: number, tableUrl: string) => {
        try {
          // Force the table URL to use www.cluny.cafe instead of any other domain
          const finalTableUrl = tableUrl.replace(/https?:\/\/[^\/]+/, "https://www.cluny.cafe");
          const qrCodeDataUrl = await QRCode.toDataURL(finalTableUrl, {
            width: 420,
            margin: 1,
            color: {
              dark: BRAND.textDark,
              light: "#FFFFFF00",
            },
            errorCorrectionLevel: "H",
          });

          const qrImage = new Image();
          qrImage.onload = () => {
            const qrSize = 400;
            const qrX = (width - qrSize) / 2;
            const qrY = 640;
            const padding = 30;

            ctx.fillStyle = BRAND.white;
            roundRect(ctx, qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2, 20);
            ctx.fill();

            ctx.strokeStyle = BRAND.sage;
            ctx.lineWidth = 2;
            roundRect(ctx, qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2, 20);
            ctx.stroke();

            ctx.save();
            ctx.shadowColor = BRAND.sage + "40";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 8;
            ctx.fillStyle = BRAND.white;
            roundRect(ctx, qrX - padding, qrY - padding, qrSize + padding * 2, qrSize + padding * 2, 20);
            ctx.fill();
            ctx.restore();

            const cornerLen = 35;
            const cornerW = 4;
            const cX = qrX - padding;
            const cY = qrY - padding;
            const cW = qrSize + padding * 2;
            const cH = qrSize + padding * 2;

            ctx.fillStyle = BRAND.teal;
            ctx.fillRect(cX, cY, cornerLen, cornerW);
            ctx.fillRect(cX, cY, cornerW, cornerLen);
            ctx.fillRect(cX + cW - cornerLen, cY, cornerLen, cornerW);
            ctx.fillRect(cX + cW - cornerW, cY, cornerW, cornerLen);
            ctx.fillRect(cX, cY + cH - cornerW, cornerLen, cornerW);
            ctx.fillRect(cX, cY + cH - cornerLen, cornerW, cornerLen);
            ctx.fillRect(cX + cW - cornerLen, cY + cH - cornerW, cornerLen, cornerW);
            ctx.fillRect(cX + cW - cornerW, cY + cH - cornerLen, cornerW, cornerLen);

            ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

            const logoOverlaySize = 55;
            const logoOverlayX = width / 2 - logoOverlaySize / 2;
            const logoOverlayY = qrY + qrSize / 2 - logoOverlaySize / 2;

            ctx.fillStyle = BRAND.white;
            ctx.beginPath();
            ctx.arc(width / 2, qrY + qrSize / 2, logoOverlaySize / 2 + 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = BRAND.sage;
            ctx.beginPath();
            ctx.arc(width / 2, qrY + qrSize / 2, logoOverlaySize / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = BRAND.white;
            ctx.font = "bold 22px 'Georgia', serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("C", width / 2, qrY + qrSize / 2);

            const ctaY = qrY + qrSize + padding + 50;

            const ctaBtnW = 480;
            const ctaBtnH = 65;
            const ctaBtnX = (width - ctaBtnW) / 2;
            const ctaBtnY = ctaY;

            const ctaGrad = ctx.createLinearGradient(ctaBtnX, ctaBtnY, ctaBtnX + ctaBtnW, ctaBtnY);
            ctaGrad.addColorStop(0, BRAND.teal);
            ctaGrad.addColorStop(1, BRAND.tealDark);
            ctx.fillStyle = ctaGrad;
            roundRect(ctx, ctaBtnX, ctaBtnY, ctaBtnW, ctaBtnH, 14);
            ctx.fill();

            ctx.fillStyle = BRAND.white;
            ctx.font = "bold 36px 'Segoe UI', Cairo, Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("امسح الكود للطلب", width / 2, ctaBtnY + ctaBtnH / 2);

            ctx.fillStyle = BRAND.textMuted;
            ctx.font = "22px 'Segoe UI', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Scan QR to Order", width / 2, ctaBtnY + ctaBtnH + 35);

            const sepY = ctaBtnY + ctaBtnH + 70;
            ctx.strokeStyle = BRAND.sageLight;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(200, sepY);
            ctx.lineTo(width / 2 - 15, sepY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(width / 2 + 15, sepY);
            ctx.lineTo(width - 200, sepY);
            ctx.stroke();

            drawLeafDecoration(ctx, width / 2 - 12, sepY, 12, Math.PI + 0.3, BRAND.sageLight);
            drawLeafDecoration(ctx, width / 2 + 12, sepY, 12, -0.3, BRAND.sageLight);

            ctx.fillStyle = BRAND.textDark;
            ctx.font = "bold 32px 'Segoe UI', Cairo, Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(branchName, width / 2, sepY + 50);

            ctx.fillStyle = BRAND.textMuted;
            ctx.font = "14px 'Segoe UI', Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Powered by CLUNY SYSTEMS", width / 2, height - 60);
          };
          qrImage.src = qrCodeDataUrl;
        } catch (error) {
          console.error("Error generating QR code:", error);
        }
      };
    };

    generateQRCard();
  }, [tableNumber, qrToken, branchName, tableUrl]);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto rounded-lg shadow-lg"
      />
    </div>
  );
}

export function downloadQRCard(canvas: HTMLCanvasElement, tableNumber: string) {
  const link = document.createElement("a");
  link.download = `table-${tableNumber}-qr-card.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
