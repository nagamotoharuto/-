"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Camera, RefreshCw, WifiOff } from "lucide-react";
import BottomNav from "@/components/features/BottomNav";

const CAMERA_STREAM_URL = process.env.NEXT_PUBLIC_CAMERA_STREAM_URL;

export default function CameraPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [streamError, setStreamError] = useState(false);

  function retry() {
    setStreamError(false);
    setReloadKey((k) => k + 1);
  }

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
        {CAMERA_STREAM_URL && (
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
        {!CAMERA_STREAM_URL ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-2xl border border-[#e8e0d8] p-8">
            <Camera size={40} className="text-[#e8e0d8]" />
            <p className="text-sm font-bold text-[#1a1a1a]">ライブカメラは準備中です</p>
            <p className="text-xs text-[#6b5e52]">
              カメラの設置が完了次第、こちらでパン棚の様子をご覧いただけます
            </p>
          </div>
        ) : streamError ? (
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
          <div className="rounded-2xl overflow-hidden border border-[#e8e0d8] shadow-sm bg-black">
            {/* MJPEG stream: a plain <img> is required, next/image cannot render a live multipart stream */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={reloadKey}
              src={CAMERA_STREAM_URL}
              alt="パン棚のライブ映像"
              className="w-full h-auto block"
              onError={() => setStreamError(true)}
            />
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
