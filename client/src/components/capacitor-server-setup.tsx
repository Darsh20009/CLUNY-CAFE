import { useState } from "react";
import { isCapacitorNative } from "@/lib/server-url";

const KEY = "qirox_server_url";

export function useCapacitorServerReady(): boolean {
  if (!isCapacitorNative()) return true;
  try {
    return !!(localStorage.getItem(KEY) || (import.meta.env.VITE_CAPACITOR_SERVER_URL as string));
  } catch {
    return false;
  }
}

export function CapacitorServerSetup({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    const trimmed = url.trim().replace(/\/$/, "");
    if (!trimmed.startsWith("http")) {
      setError("الرابط يجب أن يبدأ بـ https://");
      return;
    }
    try {
      localStorage.setItem(KEY, trimmed);
      onDone();
    } catch {
      setError("حدث خطأ، حاول مرة أخرى");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] flex flex-col items-center justify-center p-6 z-[9999]" dir="rtl">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-4">⚙️</div>
          <h1 className="text-xl font-bold text-white">إعداد رابط السيرفر</h1>
          <p className="text-sm text-gray-400">
            أدخل رابط السيرفر الخاص بالتطبيق (يوفره مشغّل النظام)
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); }}
            placeholder="https://your-server.replit.app"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/50 text-left"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="url"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        <button
          onClick={save}
          className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm active:opacity-80 transition-opacity"
        >
          حفظ والمتابعة
        </button>

        <p className="text-center text-xs text-gray-600">
          يُحفظ هذا الإعداد على جهازك فقط
        </p>
      </div>
    </div>
  );
}
