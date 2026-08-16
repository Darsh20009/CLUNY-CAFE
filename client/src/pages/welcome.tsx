import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Star, MapPin, ChevronLeft, ChevronRight, LogOut, User, KeyRound, X as XIcon, Award, Clock } from "lucide-react";
import { useCustomer } from "@/contexts/CustomerContext";
import { useTranslation } from "react-i18next";
import CurrentOrderBanner from "@/components/current-order-banner";
import { useRealtimeEvent } from "@/hooks/useRealtimeEngine";
import { useState } from "react";
import { CustomerFooter } from "@/components/customer-footer";
import bannerImage1 from "@assets/images/banner-1.png";
import bannerImage2 from "@assets/images/banner-2.png";

export default function WelcomePage() {
  const [, setLocation] = useLocation();
  const { customer, isAuthenticated, logout } = useCustomer();
  const { t, i18n } = useTranslation();
  const [verificationCode, setVerificationCode] = useState<any>(null);

  useRealtimeEvent("points_verification_code", (data: any) => {
    setVerificationCode(data);
    setTimeout(() => setVerificationCode(null), 5 * 60 * 1000);
  });

  const features = [
    {
      icon: Coffee,
      title: t("welcome.specialty"),
      desc: t("welcome.specialty_desc"),
    },
    {
      icon: Award,
      title: t("welcome.luxury"),
      desc: t("welcome.luxury_desc"),
    },
    {
      icon: MapPin,
      title: t("welcome.locations"),
      desc: t("welcome.locations_desc"),
    },
  ];

  return (
    <div
      className="min-h-screen text-foreground overflow-hidden"
      style={{ fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" }}
    >
      {/* ═══════════════════════════════════ HERO ═══════════════════════════════════ */}
      <div className="relative min-h-[100dvh] flex flex-col">

        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={bannerImage1}
            alt=""
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 30%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
          {/* subtle rose tint */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 60%, rgba(45,155,110,0.18) 0%, transparent 70%)" }} />
        </div>

        {/* Ambient blobs */}
        <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 right-8 w-24 h-24 rounded-full blur-3xl opacity-30" style={{ background: "hsl(155 55% 39%)" }} />
          <div className="absolute bottom-1/3 left-8 w-32 h-32 rounded-full blur-3xl opacity-20" style={{ background: "hsl(345 65% 55%)" }} />
        </div>

        {/* ── Header ── */}
        <header
          className="relative z-20 flex items-center justify-between px-5 pb-3"
          style={{ paddingTop: "max(env(safe-area-inset-top, 16px), 16px)" }}
        >
          {/* Logo + Name */}
          <div className="flex items-center gap-3">
            <div
              className="rounded-2xl overflow-hidden shadow-lg border border-white/10"
              style={{ width: 40, height: 40, background: "#000" }}
            >
              <img
                src="/logo.png"
                alt="CLUNY"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-base tracking-widest">CLUNY CAFE</span>
              <span className="text-white/45 text-[10px] tracking-wider">CAFE </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {verificationCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 16 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 16 }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/20 shadow-xl"
                  style={{ background: "rgba(45,155,110,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                >
                  <KeyRound className="w-4 h-4 text-white" />
                  <div className="flex flex-col leading-none">
                    <span className="text-[9px] text-white/60 mb-0.5">رمز التحقق</span>
                    <span className="text-lg font-bold text-white tracking-widest">{verificationCode.code}</span>
                  </div>
                  <button onClick={() => setVerificationCode(null)} className="text-white/40 hover:text-white p-0.5">
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isAuthenticated && (
              <button
                onClick={() => logout()}
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 text-white transition-all"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                const stored = localStorage.getItem("qahwa-customer") || localStorage.getItem("currentCustomer");
                if (isAuthenticated || customer || stored) {
                  setLocation("/profile");
                } else {
                  setLocation("/auth");
                }
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 text-white transition-all"
              style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
              data-testid="button-user-profile"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active order banner */}
        <div className="absolute top-20 left-4 right-4 z-30">
          <CurrentOrderBanner />
        </div>

        {/* ── Main Content ── */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 relative z-20 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center w-full max-w-sm"
          >
            {/* Logo mark */}
            <motion.div
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: "backOut" }}
              className="mx-auto mb-7 rounded-[28px] overflow-hidden shadow-2xl border border-white/10"
              style={{ width: 120, height: 120, background: "#000" }}
            >
              <img
                src="/logo.png"
                alt="CLUNY CAFE"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  el.parentElement!.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg></div>`;
                }}
              />
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="font-bold text-white drop-shadow-lg mb-1" style={{ fontSize: "clamp(2rem, 9vw, 3.25rem)", letterSpacing: "0.05em" }}>CLUNY CAFE </h1>
              <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-6">CAFE </p>
            </motion.div>

            {/* Greeting or tagline */}
            {isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="mb-8"
              >
                <p className="text-white text-xl font-semibold mb-1">
                  {t("welcome.greeting", { name: customer?.name })}
                </p>
                <p className="text-white/55 text-sm">
                  {t("welcome.missed_you")}
                </p>
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="text-white/65 text-base mb-8 leading-relaxed"
              >
                {t("welcome.stories")}
              </motion.p>
            )}

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <button
                onClick={() => setLocation("/menu")}
                className="w-full h-14 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97] shadow-lg"
                style={{ background: "hsl(155 55% 39%)", boxShadow: "0 4px 24px rgba(45,155,110,0.45)" }}
                data-testid="button-explore-menu"
              >
                {i18n.language === "ar"
                  ? <ChevronLeft className="w-5 h-5" />
                  : <ChevronRight className="w-5 h-5" />}
                {t(isAuthenticated ? "menu.order_now" : "welcome.explore")}
              </button>

              {!isAuthenticated ? (
                <button
                  onClick={() => setLocation("/auth")}
                  className="w-full h-14 rounded-2xl font-semibold text-base text-white/85 flex items-center justify-center transition-all duration-200 active:scale-[0.97] border border-white/20"
                  style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                  data-testid="button-login"
                >
                  {t("welcome.login")}
                </button>
              ) : (
                <button
                  onClick={() => setLocation("/profile")}
                  className="w-full h-14 rounded-2xl font-semibold text-base text-white/85 flex items-center justify-center transition-all duration-200 active:scale-[0.97] border border-white/20"
                  style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                  data-testid="button-my-account"
                >
                  {t("welcome.my_account")}
                </button>
              )}
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-8 flex items-center justify-center gap-5"
            >
              {[
                { icon: Star, label: "4.9★" },
                { icon: Clock, label: "20 دقيقة" },
                { icon: Award, label: "نقاط ولاء" },
              ].map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <b.icon className="w-4 h-4 text-white/35" />
                  <span className="text-white/40 text-[10px]">{b.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-20 flex justify-center"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 20px), 20px)" }}
        >
          <div className="w-5 h-8 border border-white/20 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/40 rounded-full" />
          </div>
        </motion.div>
      </div>
      {/* ═══════════════════════════════════ FEATURES ═══════════════════════════════════ */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-bold mb-2" style={{ color: "hsl(155 55% 39%)" }}>
              {t("welcome.why")}
            </h2>
            <p className="text-gray-400 text-sm">{t("welcome.experience")}</p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50/60"
              >
                <div
                  className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "hsl(155 55% 39% / 0.1)" }}
                >
                  <f.icon className="w-5 h-5" style={{ color: "hsl(155 55% 39%)" }} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-0.5 text-base">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* ═══════════════════════════════════ GALLERY ═══════════════════════════════════ */}
      <section className="py-12 px-6 bg-gray-50">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-md"
            >
              <img src={bannerImage1} alt="Coffee" className="w-full h-44 object-cover" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-md"
            >
              <img src={bannerImage2} alt="Coffee" className="w-full h-44 object-cover" />
            </motion.div>
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 text-center"
          >
            <button
              onClick={() => setLocation("/menu")}
              className="w-full h-13 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.97]"
              style={{ height: 52, background: "hsl(155 55% 39%)", boxShadow: "0 4px 24px rgba(45,155,110,0.35)" }}
            >
              {i18n.language === "ar" ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              {t("welcome.explore")}
            </button>
          </motion.div>
        </div>
      </section>
      <CustomerFooter />
    </div>
  );
}
