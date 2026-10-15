export type InvoiceSurface = "customer" | "staff";
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
  headerArtwork: "campaign" | "logo" | "custom" | "none";
  customArtworkUrl: string;
  elements: Record<string, boolean>;
  customQrs: InvoiceQr[];
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  mode: "default",
  headerArtwork: "campaign",
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
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    ...(value && typeof value === "object" ? value : {}),
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
            surface: ["all", "customer", "staff"].includes(qr.surface) ? qr.surface : "all",
            enabled: qr.enabled !== false,
          }))
      : [],
  };
}
