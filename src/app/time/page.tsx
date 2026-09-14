"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ArrowRight, MapPin, CalendarDays } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import StepIndicator from "@/components/features/StepIndicator";
import { useBakeryStore } from "@/lib/store";
import {
  cn,
  formatJstDateLabel,
  getAvailableTimeSlots,
  getReservableDates,
  isWithinSalesHours,
  RELEASE_GRACE_MINUTES,
} from "@/lib/utils";

export default function TimePage() {
  const router = useRouter();
  const { user, pickupDate, pickupTime, setPickupDate, setPickupTime } = useBakeryStore();
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(pickupDate);
  const [selectedTime, setSelectedTime] = useState(pickupTime);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (!isWithinSalesHours()) {
      router.push("/");
    }
  }, [user, router]);

  // Computed on the client so the list stays right as the clock crosses a slot
  useEffect(() => {
    function refreshDates() {
      const next = getReservableDates();
      setDates(next);
      setSelectedDate((current) => (current && next.includes(current) ? current : next[0] ?? ""));
    }
    refreshDates();
    const id = setInterval(refreshDates, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const timeSlots = selectedDate ? getAvailableTimeSlots(selectedDate) : [];

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedTime("");
    setError("");
  }

  function handleNext() {
    if (!selectedDate) {
      setError("受け取り日を選択してください");
      return;
    }
    if (!selectedTime) {
      setError("受け取り時間を選択してください");
      return;
    }
    setPickupDate(selectedDate);
    setPickupTime(selectedTime);
    router.push("/menu");
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-32">
      <Header />

      <div className="max-w-md mx-auto w-full px-4">
        <StepIndicator current={1} />

        <h2 className="text-lg font-bold mb-2 text-[#1a1a1a]">受け取り日時</h2>
        <p className="text-xs text-[#6b5e52] mb-6">
          本日分に加えて、次の営業日分もご予約いただけます。商品と個数は受け取り日ごとに決まっています。
        </p>

        {/* Store info */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mb-6">
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-[#8B1A2C] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#1a1a1a]">受け取り場所</p>
              <p className="text-sm text-[#6b5e52]">1F 正面玄関前</p>
              <p className="text-xs text-[#6b5e52] mt-1">営業時間：平日11:00〜15:00（土日祝休業）</p>
            </div>
          </div>
        </div>

        {/* Date selector */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#6b5e52] mb-3">
            <CalendarDays size={14} />
            受け取り日
          </label>
          {dates.length === 0 ? (
            <p className="text-sm text-[#6b5e52]">現在ご予約いただける日がありません</p>
          ) : (
            <div className="flex flex-col gap-2">
              {dates.map((date) => (
                <button
                  key={date}
                  onClick={() => handleSelectDate(date)}
                  className={cn(
                    "w-full rounded-xl px-4 py-3 text-sm font-bold text-left border-2 transition-colors",
                    selectedDate === date
                      ? "border-[#8B1A2C] bg-[#8B1A2C]/5 text-[#8B1A2C]"
                      : "border-[#e8e0d8] bg-[#fdf8f3] text-[#1a1a1a] hover:border-[#8B1A2C]"
                  )}
                >
                  {formatJstDateLabel(date)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Time selector */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <label className="block text-xs font-bold text-[#6b5e52] mb-2">時間</label>
          <select
            value={selectedTime}
            onChange={(e) => {
              setSelectedTime(e.target.value);
              setError("");
            }}
            disabled={!selectedDate || timeSlots.length === 0}
            className="w-full border border-[#e8e0d8] rounded-xl px-4 py-3 bg-[#fdf8f3] text-sm font-medium text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] appearance-none cursor-pointer disabled:opacity-50"
          >
            <option value="">
              {timeSlots.length === 0 ? "選択できる時間がありません" : "時間を選択してください"}
            </option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {selectedDate && selectedTime && (
          <div className="bg-[#8B1A2C]/10 border border-[#8B1A2C]/20 rounded-2xl p-4 flex items-center gap-3 mb-3">
            <Clock size={20} className="text-[#8B1A2C]" />
            <div>
              <p className="text-xs text-[#8B1A2C] font-medium">受け取り予定</p>
              <p className="text-base font-black text-[#8B1A2C]">
                {formatJstDateLabel(selectedDate)} {selectedTime}
              </p>
            </div>
          </div>
        )}

        <p className="text-xs text-[#6b5e52]">
          受け取り時間から{RELEASE_GRACE_MINUTES}分を過ぎてもお越しいただけない場合、
          ご予約は自動的に取り消され店頭販売に戻りますのでご注意ください。
        </p>
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 z-40">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleNext}
            className="w-full bg-[#8B1A2C] text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold text-base shadow-lg hover:bg-[#A52235] transition-colors"
          >
            商品を選ぶ
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
