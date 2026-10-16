export type InvoiceSurface = "customer" | "cashier" | "staff";
export type InvoiceQrSurface = "all" | InvoiceSurface;

export interface InvoiceQr {
  id: string;
  label: string;
  content: string;
  surface: InvoiceQrSurface;
  enabled: boolean;
}

export interface InvoiceSettings {
  mode: "default" | "custom";
  templateStyle: "standard" | "patriotic";
  headerArtwork: "campaign" | "logo" | "custom" | "none";
  customArtworkUrl: string;
  elements: Record<string, boolean>;
  customQrs: InvoiceQr[];
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  mode: "default",
  templateStyle: "standard",
  headerArtwork: "none",
  customArtworkUrl: "",
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
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
    mode,
    templateStyle,
    headerArtwork: templateStyle === "patriotic"
      ? (mode === "default" ? "campaign" : requestedArtwork)
      : (mode === "default" ? "none" : requestedArtwork),
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
