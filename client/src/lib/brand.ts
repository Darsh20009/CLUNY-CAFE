export const brand = {
  nameEn: "CLUNY CAFE",
  nameAr: "كلوني كافيه",
  shortNameEn: "CLUNY",
  shortNameAr: "كلوني",
  platformNameEn: "CLUNY SYSTEMS",
  platformNameAr: "كلوني سيستمز",
  taglineEn: "Premium Coffee Experience",
  taglineAr: "تجربة قهوة مميزة",
  descriptionEn: "Enjoy the finest premium coffee crafted with care. Order now from CLUNY CAFE for an exceptional coffee experience.",
  descriptionAr: "استمتع بأرقى تجربة قهوة مميزة محضرة بعناية استثنائية من كلوني كافيه - اطلب الآن واستمتع بلحظات استثنائية",
  keywords: "قهوة مميزة, CLUNY CAFE, كلوني, coffee, cafe, كافيه, اسبريسو, لاتيه, كابتشينو, موكا, قهوة سعودية, طلب قهوة, توصيل قهوة, كافيه مميز",

  logoCustomer: "/cluny-logo.png",
  logoStaff: "/cluny-logo.png",
  favicon: "/cluny-logo.png",
  appleTouchIcon: "/cluny-logo.png",
  logoAssetCustomer: "cluny-logo-customer.png",
  logoAssetStaff: "cluny-logo-staff.png",
  logoEmailUrl: "https://cluny.cafe/cluny-logo.png",
  ogImageUrl: "/cluny-logo.png",

  colors: {
    primary: { h: 155, s: 55, l: 39, hex: "#2D9B6E" },
    primaryLight: { h: 155, s: 50, l: 50, hex: "#3EB882" },
    background: { h: 0, s: 0, l: 100, hex: "#FFFFFF" },
    surface: { h: 0, s: 0, l: 98, hex: "#FAFAFA" },
    accent: { h: 207, s: 90, l: 54, hex: "#2196F3" },
  },

  themeColor: "#2D9B6E",
  pwaBackgroundColor: "#FFFFFF",
  pwaDisplay: "standalone" as const,

  website: "cluny.cafe",
  websiteUrl: "https://www.cluny.cafe",
  emailNoReply: "noreply@cluny.cafe",
  emailSupport: "support@cluny.cafe",
  social: {
    instagram: "@clunycafe",
    twitter: "@clunycafe",
    snapchat: "@clunycafe",
    tiktok: "@clunycafe",
  },

  commercialRegister: "",
  taxNumber: "",
  registrationNumber: "",
  saudiBusinessUrl: "https://qr.saudibusiness.gov.sa/viewcr?nCrNumber=9AhyCS491ZPTmJxSxD96YA==",

  pointsBrandEn: "CLUNY Points",
  pointsBrandAr: "نقاط كلوني",
  cardBrandEn: "CLUNY Card",
  cardBrandAr: "بطاقة كلوني",
  loyaltyTaglineEn: "CLUNY CAFE Loyalty",
  loyaltyTaglineAr: "برنامج ولاء كلوني",

  aiAssistantNameEn: "CLUNY AI Assistant",
  aiAssistantNameAr: "مساعد كلوني الذكي",

  copyrightEn: `© ${new Date().getFullYear()} CLUNY SYSTEMS. ALL RIGHTS RESERVED`,
  copyrightAr: `© ${new Date().getFullYear()} كلوني سيستمز - جميع الحقوق محفوظة`,
} as const;

export function hsl(color: { h: number; s: number; l: number }): string {
  return `${color.h} ${color.s}% ${color.l}%`;
}

export function hslFull(color: { h: number; s: number; l: number }): string {
  return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}

export function applyBrandColors(): void {
  const root = document.documentElement;
  const { colors } = brand;
  root.style.setProperty("--primary", hsl(colors.primary));
  root.style.setProperty("--primary-light", hsl(colors.primaryLight));
  root.style.setProperty("--ring", hsl(colors.primary));
  root.style.setProperty("--accent", hsl(colors.accent));
  root.style.setProperty("--accent-foreground", "0 0% 100%");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute("content", brand.themeColor);
}

export function setPageTitle(pageTitle?: string): void {
  document.title = pageTitle ? `${pageTitle} | ${brand.nameEn}` : `${brand.nameEn} | ${brand.taglineEn}`;
}

export function getBrandName(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.nameAr : brand.nameEn;
}

export function getPlatformName(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.platformNameAr : brand.platformNameEn;
}

export function getTagline(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.taglineAr : brand.taglineEn;
}

export function getCopyright(lang: "ar" | "en" = "ar"): string {
  return lang === "ar" ? brand.copyrightAr : brand.copyrightEn;
}

export default brand;
