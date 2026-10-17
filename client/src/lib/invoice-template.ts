export type InvoiceSurface = "customer" | "cashier" | "staff";
export type InvoiceQrSurface = "all" | InvoiceSurface;

export interface InvoiceQr {
  id: string;
  label: string;
  content: string;
  surface: InvoiceQrSurface;
  enabled: boolean;
}

export interface InvoiceArtwork {
  id: string;
  name: string;
  url: string;
}

export interface InvoiceSettings {
  mode: "default" | "custom";
  templateStyle: "standard" | "patriotic";
  headerArtwork: "campaign" | "logo" | "custom" | "none";
  customArtworkUrl: string;
  artworkLibrary: InvoiceArtwork[];
  elements: Record<string, boolean>;
  customQrs: InvoiceQr[];
}

export const ATTACHED_PATRIOTIC_ARTWORK: InvoiceArtwork = {
  id: "cluny-patriotic-attached",
  name: "الصورة الوطنية المرفقة — كلوني",
  url: "/attached_assets/Screenshot_1448-05-06_at_1.49.26_AM_1792191592011.png",
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  mode: "default",
  templateStyle: "standard",
  headerArtwork: "none",
  customArtworkUrl: "",
  artworkLibrary: [ATTACHED_PATRIOTIC_ARTWORK],
  elements: {
    headerArtwork: true,
    orderNumber: true,
    logo: true,
    businessInfo: true,
    orderType: true,
    cashier: true,
    items: true,
    itemCount: true,
    totals: true,
    paymentMethod: true,
    customerNotes: true,
    tagline: true,
    trackingQr: true,
    zatcaQr: true,
    poweredBy: true,
  },
  customQrs: [],
};

export function normalizeInvoiceSettings(value: any): InvoiceSettings {
  const mode = value?.mode === "custom" ? "custom" : "default";
  const templateStyle = value?.templateStyle === "patriotic" ? "patriotic" : "standard";
  const requestedArtwork = ["campaign", "logo", "custom", "none"].includes(value?.headerArtwork)
    ? value.headerArtwork
    : DEFAULT_INVOICE_SETTINGS.headerArtwork;
  const allowedArtworkUrl = (url: unknown) => {
    const value = String(url || "").trim();
    return /^https:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//"));
  };
  const uploadedArtwork = Array.isArray(value?.artworkLibrary)
    ? value.artworkLibrary
        .filter((image: any) =>
          image &&
          typeof image.id === "string" &&
          image.id !== ATTACHED_PATRIOTIC_ARTWORK.id &&
          typeof image.name === "string" &&
          allowedArtworkUrl(image.url),
        )
        .slice(0, 30)
        .map((image: any) => ({
          id: image.id.slice(0, 100),
          name: image.name.trim().slice(0, 120) || "صورة فاتورة",
          url: String(image.url).trim().slice(0, 2048),
        }))
    : [];
  const seenArtworkIds = new Set<string>([ATTACHED_PATRIOTIC_ARTWORK.id]);
  const artworkLibrary = [
    ATTACHED_PATRIOTIC_ARTWORK,
    ...uploadedArtwork.filter((image: InvoiceArtwork) => {
      if (seenArtworkIds.has(image.id)) return false;
      seenArtworkIds.add(image.id);
      return true;
    }),
  ];
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
    mode,
    templateStyle,
    headerArtwork: templateStyle === "patriotic"
      ? (mode === "default" ? "campaign" : requestedArtwork)
      : (mode === "default" ? "none" : requestedArtwork),
    artworkLibrary,
    elements: {
      ...DEFAULT_INVOICE_SETTINGS.elements,
      ...(value?.elements && typeof value.elements === "object" ? value.elements : {}),
    },
    customQrs: Array.isArray(value?.customQrs)
      ? value.customQrs
          .filter((qr: any) => qr && typeof qr.id === "string")
          .map((qr: any) => ({
            id: qr.id,
            label: String(qr.label || ""),
            content: String(qr.content || ""),
            surface: ["all", "customer", "cashier", "staff"].includes(qr.surface) ? qr.surface : "all",
            enabled: qr.enabled !== false,
          }))
      : [],
  };
}
