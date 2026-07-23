"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Camera, RefreshCw, WifiOff, Croissant } from "lucide-react";
import BottomNav from "@/components/features/BottomNav";

// URL of the camera's single-snapshot endpoint (ESP32 CameraWebServer's "/capture" on port 80,
// exposed via a tunnel), e.g. https://xxxx.trycloudflare.com/capture
// NOT the "/stream" (multipart/x-mixed-replace) endpoint: iOS/macOS Safari cannot render
// multipart MJPEG in an <img>, so instead we poll a fresh single JPEG on an interval.
const CAMERA_SNAPSHOT_URL = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL;
const REFRESH_INTERVAL_MS = 1500;
const FAIL_THRESHOLD = 4;
const SHELF_COUNT_INTERVAL_MS = 30_000;

interface ShelfCountItem {
  id: string;
  name: string;
  count: number;
}

interface ShelfCountResult {
  items: ShelfCountItem[];
  updatedAt: string;
  error: string | null;
}

export default function CameraPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [shelfCount, setShelfCount] = useState<ShelfCountResult | null>(null);

  useEffect(() => {
    if (!CAMERA_SNAPSHOT_URL) return;

    function refresh() {
      setSrc(`${CAMERA_SNAPSHOT_URL}?t=${Date.now()}`);
    }

    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!CAMERA_SNAPSHOT_URL) return;

    function refreshCount() {
      fetch("/api/shelf-count")
        .then((r) => r.json())
        .then(setShelfCount)
        .catch(() => {});
    }

    refreshCount();
    const id = setInterval(refreshCount, SHELF_COUNT_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  function retry() {
    setFailCount(0);
    if (CAMERA_SNAPSHOT_URL) setSrc(`${CAMERA_SNAPSHOT_URL}?t=${Date.now()}`);
  }

  const showError = failCount >= FAIL_THRESHOLD;

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
      <header className="bg-[#8B1A2C] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#A8C8F0] hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-[#F0AA5A]" />
            <span className="font-bold text-sm">ライブカメラ（パン棚）</span>
          </div>
        </div>
        {CAMERA_SNAPSHOT_URL && (
          <button
            onClick={retry}
            className="flex items-center gap-1 text-xs text-[#A8C8F0] hover:text-white"
          >
            <RefreshCw size={14} />
            再読み込み
          </button>
        )}
      </header>

      <div className="max-w-md mx-auto w-full px-4 py-4 flex-1 flex flex-col">
        {!CAMERA_SNAPSHOT_URL ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-2xl border border-[#e8e0d8] p-8">
            <Camera size={40} className="text-[#e8e0d8]" />
            <p className="text-sm font-bold text-[#1a1a1a]">ライブカメラは準備中です</p>
            <p className="text-xs text-[#6b5e52]">
              カメラの設置が完了次第、こちらでパン棚の様子をご覧いただけます
            </p>
          </div>
        ) : showError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-2xl border border-[#e8e0d8] p-8">
            <WifiOff size={40} className="text-[#e8e0d8]" />
            <p className="text-sm font-bold text-[#1a1a1a]">映像を取得できませんでした</p>
            <p className="text-xs text-[#6b5e52]">
              カメラの電源やネットワーク接続をご確認のうえ、再読み込みしてください
            </p>
            <button
              onClick={retry}
              className="mt-2 bg-[#8B1A2C] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#A52235] transition-colors"
            >
              再読み込み
            </button>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-[#e8e0d8] shadow-sm bg-black min-h-[240px]">
            {/* Polled single-JPEG snapshot: works on every browser, including iOS Safari
                (which cannot render a multipart/x-mixed-replace MJPEG stream in an <img>) */}
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt="パン棚のライブ映像"
                className="w-full h-auto block"
                onError={() => setFailCount((c) => c + 1)}
                onLoad={() => setFailCount(0)}
              />
            )}
          </div>
        )}

        {shelfCount && shelfCount.items.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mt-4">
            <p className="text-xs font-bold text-[#1a1a1a] mb-2 flex items-center gap-1.5">
              <Croissant size={14} className="text-[#8B1A2C]" />
              パンの在庫目安（AIカウント）
            </p>
            <div className="flex flex-col gap-1.5">
              {shelfCount.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-[#6b5e52]">{item.name}</span>
                  <span className="font-bold text-[#8B1A2C]">{item.count}個</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#6b5e52] mt-2">
              AIが映像から自動で数えているため、実際の個数と誤差が生じる場合があります・最終更新{" "}
              {new Date(shelfCount.updatedAt).toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        <p className="text-xs text-[#6b5e52] text-center mt-4">
          映像は数秒遅れて表示される場合があります。在庫の最終確認はメニュー画面をご覧ください
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
