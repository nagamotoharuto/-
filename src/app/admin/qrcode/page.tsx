"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { QrCode, Printer, ChefHat } from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";

export default function QrCodePage() {
  const router = useRouter();
  const [homeUrl] = useState(() =>
    typeof window !== "undefined" ? `${window.location.origin}/` : ""
  );
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }
    if (!homeUrl) return;

    QRCode.toDataURL(homeUrl, { width: 640, margin: 2, color: { dark: "#1a1a1a", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setError("QRコードの生成に失敗しました"));
  }, [router, homeUrl]);

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      {/* Staff-facing controls (hidden when printing) */}
      <div className="max-w-2xl mx-auto px-4 py-4 print:hidden">
        <h1 className="font-black text-[#1a1a1a] text-lg flex items-center gap-2 mb-1">
          <QrCode size={18} className="text-[#8B1A2C]" />
          QRコード
        </h1>
        <p className="text-xs text-[#6b5e52] mb-4">
          このQRコードを読み取ると、アプリのホーム画面に移動します。印刷して学内に掲示してください。
        </p>

        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-6 flex flex-col items-center gap-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !qrDataUrl ? (
            <div className="w-64 h-64 rounded-xl bg-[#f5f0eb] animate-pulse" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="アプリのQRコード" className="w-64 h-64" />
          )}

          <p className="text-xs text-[#6b5e52] break-all text-center">{homeUrl}</p>

          <button
            onClick={() => window.print()}
            disabled={!qrDataUrl}
            className="flex items-center gap-2 bg-[#8B1A2C] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-[#A52235] transition-colors disabled:opacity-50"
          >
            <Printer size={16} />
            印刷する
          </button>
        </div>
      </div>

      {/* Poster layout: shown only when printing */}
      <div className="hidden print:flex flex-col items-center justify-center min-h-screen px-12 py-16 text-center gap-8">
        <div className="flex items-center gap-3">
          <ChefHat size={36} className="text-[#8B1A2C]" />
          <span className="text-2xl font-black text-[#1a1a1a] tracking-wide">University Bakery</span>
        </div>

        <h2 className="text-4xl font-black text-[#1a1a1a] leading-snug">
          スマホでQRコードを読み取って
          <br />
          パンを事前予約しよう！
        </h2>

        {qrDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="アプリのQRコード" className="w-[420px] h-[420px]" />
        )}

        <p className="text-lg text-[#6b5e52]">{homeUrl}</p>

        <p className="text-sm text-[#6b5e52]">
          ご予約は平日11:00〜15:00　受け取りは1F 正面玄関前
        </p>
      </div>
    </div>
  );
}
