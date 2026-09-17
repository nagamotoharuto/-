"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, ImageIcon, ImageOff } from "lucide-react";

export default function ImageUploadZone({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewBroken, setPreviewBroken] = useState(false);

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "アップロード失敗");
      } else {
        setPreviewBroken(false);
        onUploaded(data.url);
      }
    } catch {
      setUploadError("通信エラーが発生しました");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div>
      {/* Current image preview */}
      {currentUrl && (
        <div className="relative w-full h-36 rounded-xl overflow-hidden bg-[#f5f0eb] mb-2">
          {previewBroken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[#c8bdb5]">
              <ImageOff size={22} />
              <span className="text-xs">写真を読み込めません。登録し直してください</span>
            </div>
          ) : (
            <Image
              src={currentUrl}
              alt="現在の写真"
              fill
              className="object-cover"
              sizes="100vw"
              onError={() => setPreviewBroken(true)}
            />
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs py-1 text-center">
            現在の写真
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragging
            ? "border-[#8B1A2C] bg-[#8B1A2C]/5"
            : "border-[#e8e0d8] hover:border-[#8B1A2C] hover:bg-[#8B1A2C]/5"
        }`}
      >
        {uploading ? (
          <>
            <div className="w-6 h-6 border-2 border-[#8B1A2C] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#6b5e52]">アップロード中...</p>
          </>
        ) : (
          <>
            <Upload size={22} className={dragging ? "text-[#8B1A2C]" : "text-[#6b5e52]"} />
            <p className="text-xs font-bold text-[#6b5e52] text-center">
              クリックまたはドラッグ＆ドロップ
            </p>
            <p className="text-xs text-[#6b5e52]">JPEG・PNG・WebP・GIF（5MBまで）</p>
          </>
        )}
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 mt-1">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

