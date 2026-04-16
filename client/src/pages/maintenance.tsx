import { motion } from "framer-motion";
import { Coffee, Settings, Wrench, Clock } from "lucide-react";
import clunyLogo from "@assets/cluny-logo-customer.png";

export default function MaintenancePage({ reason = "maintenance" }: { reason?: string }) {

  const isUpdate = reason === "update" || reason === "تحديث";

  return (
    <div className="min-h-screen bg-[#F7F8F8] dark:bg-[#1a1410] flex flex-col items-center justify-center p-4 text-center" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="relative inline-block">
          <img src={clunyLogo} alt="CLUNY CAFE" className="w-24 h-24 mx-auto rounded-3xl shadow-xl mb-6" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -top-2 -right-2 bg-primary p-2 rounded-full shadow-lg"
          >
            {isUpdate ? <Clock className="w-5 h-5 text-white" /> : <Settings className="w-5 h-5 text-white" />}
          </motion.div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-[#1F2D2E] dark:text-white font-ibm-arabic">
            {isUpdate ? "جاري التحديث..." : "الموقع تحت الصيانة"}
          </h1>
          <p className="text-[#6B7C7D] dark:text-gray-400 text-lg leading-relaxed">
            {isUpdate 
              ? "نحن نقوم بإضافة مميزات جديدة لنقدم لكم تجربة أفضل. سنعود قريباً جداً!" 
              : "نحن نقوم ببعض أعمال الصيانة الدورية لنضمن لكم أفضل جودة. شكراً لصبركم!"}
          </p>
        </div>

        <div className="py-8">
          <div className="flex justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Coffee className="w-6 h-6 text-primary animate-bounce" />
            </div>
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent animate-pulse" />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground italic">
            استمتع برائحة القهوة ريثما نعود... ☕
          </p>
        </div>
      </motion.div>
    </div>
  );
}
