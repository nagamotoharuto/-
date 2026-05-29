"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ArrowRight, MapPin } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import StepIndicator from "@/components/features/StepIndicator";
import { useBakeryStore } from "@/lib/store";
import { getTimeSlots } from "@/lib/utils";

const TIME_SLOTS = getTimeSlots();

export default function TimePage() {
  const router = useRouter();
  const { pickupTime, setPickupTime } = useBakeryStore();
  const [selected, setSelected] = useState(pickupTime || "");
  const [error, setError] = useState("");

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}月${today.getDate()}日（${["日", "月", "火", "水", "木", "金", "土"][today.getDay()]}）本日`;

  function handleNext() {
    if (!selected) {
      setError("受け取り時間を選択してください");
      return;
    }
    setPickupTime(selected);
    router.push("/payment");
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-32">
      <Header />

      <div className="max-w-md mx-auto w-full px-4">
        <StepIndicator current={2} />

        <h2 className="text-lg font-bold mb-2 text-[#1a1a1a]">受け取り日時</h2>
        <p className="text-xs text-[#6b5e52] mb-6">
          受け取りは当日のみです。売り切れの場合はご連絡します。
        </p>

        {/* Store info - KFC style */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-6">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-[#1B3A6B] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#1a1a1a]">受け取り場所</p>
              <p className="text-sm text-[#6b5e52]">1F 正面玄関前</p>
              <p className="text-xs text-[#6b5e52] mt-1">営業時間：11:00〜15:00</p>
            </div>
          </div>
        </div>

        {/* Date selector - KFC style */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <label className="block text-xs font-bold text-[#6b5e52] mb-2">日にち</label>
          <div className="border border-[#e8e0d8] rounded-xl px-4 py-3 bg-[#fdf8f3] text-sm font-medium text-[#1a1a1a] flex items-center justify-between">
            <span>{dateLabel}</span>
            <span className="text-xs text-[#6b5e52] bg-[#e8e0d8] px-2 py-0.5 rounded-full">当日のみ</span>
          </div>
        </div>

        {/* Time selector - KFC style */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <label className="block text-xs font-bold text-[#6b5e52] mb-2">時間</label>
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); setError(""); }}
            className="w-full border border-[#e8e0d8] rounded-xl px-4 py-3 bg-[#fdf8f3] text-sm font-medium text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] appearance-none cursor-pointer"
          >
            <option value="">時間を選択してください</option>
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {selected && (
          <div className="bg-[#1B3A6B]/10 border border-[#1B3A6B]/20 rounded-2xl p-4 flex items-center gap-3">
            <Clock size={20} className="text-[#1B3A6B]" />
            <div>
              <p className="text-xs text-[#1B3A6B] font-medium">受け取り予定時刻</p>
              <p className="text-xl font-black text-[#1B3A6B]">{selected}</p>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleNext}
            className="w-full bg-[#1B3A6B] text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:bg-[#2E5BA8] transition-colors"
          >
            お支払い方法へ
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
