"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Camera, RefreshCw, WifiOff, Croissant } from "lucide-react";
import BottomNav from "@/components/features/BottomNav";
import { toJstDateString } from "@/lib/utils";

// URL of the camera's single-snapshot endpoint (ESP32 CameraWebServer's "/capture" on port 80,
// exposed via a tunnel), e.g. https://xxxx.trycloudflare.com/capture
// NOT the "/stream" (multipart/x-mixed-replace) endpoint: iOS/macOS Safari cannot render
// multipart MJPEG in an <img>, so instead we poll a fresh single JPEG on an interval.
const CAMERA_SNAPSHOT_URL = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL;
const REFRESH_INTERVAL_MS = 1500;
const FAIL_THRESHOLD = 4;
// 棚の数はシステムが把握しているので、映像ほど頻繁に取り直す必要はない
const SHELF_COUNT_INTERVAL_MS = 15_000;

interface ShelfItem {
  id: string;
  name: string;
  subCategory: string;
  plannedQty: number;
  remainingStock: number;
}

export default function CameraPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [shelf, setShelf] = useState<ShelfItem[] | null>(null);
  const [shelfUpdatedAt, setShelfUpdatedAt] = useState<Date | null>(null);

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
    // 画面に出す個数は、店頭の残数（発注数 − 飛び込み販売 − 受け渡し済み）。
    // 映像から推測するのではなく、販売員の記録と同じ数字を見せる。
    function refreshShelf() {
      const today = toJstDateString();
      fetch(`/api/daily-stock?date=${today}`)
        .then((r) => r.json())
        .then((data) => {
          const items: ShelfItem[] = Array.isArray(data.items) ? data.items : [];
          setShelf(items.filter((i) => i.subCategory === "bread" && i.plannedQty > 0));
          setShelfUpdatedAt(new Date());
        })
        .catch(() => {});
    }

    refreshShelf();
    const id = setInterval(refreshShelf, SHELF_COUNT_INTERVAL_MS);
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

        {/* 棚の個数は販売員の記録と同じ数字。映像からの推測ではない。 */}
        {shelf && shelf.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mt-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-xs font-bold text-[#1a1a1a] flex items-center gap-1.5">
                <Croissant size={14} className="text-[#8B1A2C]" />
                いま棚にあるパン
              </p>
              <p className="text-xs text-[#6b5e52]">
                全部で
                <strong className="text-[#8B1A2C] text-lg mx-1 tabular-nums">
                  {shelf.reduce((sum, i) => sum + i.remainingStock, 0)}
                </strong>
                個
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {shelf.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className={item.remainingStock === 0 ? "text-[#c8bdb5]" : "text-[#6b5e52]"}>
                    {item.name}
                  </span>
                  <span
                    className={
                      item.remainingStock === 0
                        ? "font-bold text-[#c8bdb5]"
                        : "font-bold text-[#8B1A2C]"
                    }
                  >
                    {item.remainingStock === 0 ? "売り切れ" : `${item.remainingStock}個`}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#6b5e52] mt-2">
              販売記録にもとづく残りの数です・最終更新{" "}
              {shelfUpdatedAt?.toLocaleTimeString("ja-JP", {
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
