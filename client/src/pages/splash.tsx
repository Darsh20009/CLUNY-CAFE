import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clunyLogo from "@assets/cluny-logo-customer.png";
import ButtonPourAnimation from "@/components/button-pour-animation";
import { ChevronLeft } from "lucide-react";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);

  useEffect(() => {
    const hasSeenSplash = localStorage.getItem("hasSeenSplash");
    if (hasSeenSplash) {
      setShouldShow(false);
      setLocation("/menu");
      return;
    }

    setShouldShow(true);
    localStorage.setItem("hasSeenSplash", "true");

    // After 2 seconds, redirect to menu
    const timer = setTimeout(() => {
      setLoading(false);
      setTimeout(() => setLocation("/menu"), 300);
    }, 2000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  if (shouldShow === false) return null;

  return (
    <div className="fixed inset-0 bg-[#233230] flex items-center justify-center z-50 overflow-hidden font-ibm-arabic">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#B58B5A] rounded-full blur-[120px]" />
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
            transition={{ duration: 0.8 }}
            className="relative z-10 flex flex-col items-center max-w-xs w-full px-6"
          >
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="mb-16"
            >
              <img src={clunyLogo} alt="CLUNY" className="w-24 h-24 object-contain brightness-0 invert" />
            </motion.div>

            {/* The Animated Button that fills with coffee */}
            <div className="relative w-full h-16 bg-transparent rounded-xl border border-white/20 flex items-center justify-center overflow-hidden group shadow-2xl">
              <ButtonPourAnimation />
              <span className="relative z-20 text-white text-xl font-medium flex items-center drop-shadow-md">
                استكشف القائمة
                <ChevronLeft className="mr-2 w-6 h-6" />
              </span>
            </div>

            {/* Brand Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="text-center mt-16"
            >
              <h1 className="text-4xl font-playfair tracking-[0.2em] text-white mb-2 font-semibold">
                CLUNY
              </h1>
              <p className="text-white/70 text-sm tracking-[0.3em] uppercase font-medium">
                Crafting Your Moment
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
