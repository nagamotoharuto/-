"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Gift, Flame, ShoppingBag, Calendar } from "lucide-react";
import Header from "@/components/features/Header";
import BottomNav from "@/components/features/BottomNav";
import { useBakeryStore } from "@/lib/store";
import { STAMPS_PER_CARD, USER_TYPE_LABELS } from "@/lib/utils";

interface StampCard {
  stamps: number;
  totalOrders: number;
  streak: number;
  lastOrderDate: string;
}

export default function MyPage() {
  const router = useRouter();
  const { user } = useBakeryStore();
  const [card, setCard] = useState<StampCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    fetch(`/api/stamp?nickname=${encodeURIComponent(user.nickname)}`)
      .then((r) => r.json())
      .then(setCard)
      .finally(() => setLoading(false));
  }, [user, router]);

  if (!user) return null;

  const stamps = card?.stamps ?? 0;
  const streak = card?.streak ?? 0;
  const totalOrders = card?.totalOrders ?? 0;
  const progress = stamps / STAMPS_PER_CARD;
  const remaining = STAMPS_PER_CARD - stamps;

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
      <Header />

      <div className="max-w-md mx-auto w-full px-4 py-4">
        {/* Profile */}
        <div className="bg-[#1a4d2e] text-white rounded-2xl p-5 mb-4 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#c8843a] rounded-full flex items-center justify-center text-xl font-black">
              {user.nickname.charAt(0)}
            </div>
            <div>
              <p className="font-black text-lg">{user.nickname}</p>
              <p className="text-xs text-green-200">
                {USER_TYPE_LABELS[user.userType] ?? user.userType}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: ShoppingBag, label: "合計注文", value: totalOrders, unit: "回" },
              { icon: Flame, label: "連続日数", value: streak, unit: "日" },
              { icon: Star, label: "スタンプ", value: stamps, unit: `/${STAMPS_PER_CARD}` },
            ].map(({ icon: Icon, label, value, unit }) => (
              <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
                <Icon size={16} className="mx-auto mb-1 text-[#c8843a]" />
                <p className="text-xs text-green-200">{label}</p>
                <p className="font-black text-lg">
                  {value}
                  <span className="text-xs font-normal text-green-200">{unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stamp card - Coke ON style */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-[#1a1a1a]">スタンプカード</h2>
            <span className="text-xs text-[#6b5e52] bg-[#f5f0eb] px-2 py-1 rounded-full">
              {STAMPS_PER_CARD}個で1品無料
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-5 gap-2">
              {[...Array(STAMPS_PER_CARD)].map((_, i) => (
                <div key={i} className="aspect-square rounded-full bg-[#f5f0eb] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[...Array(STAMPS_PER_CARD)].map((_, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-full flex items-center justify-center transition-all ${
                      i < stamps
                        ? "bg-[#1a4d2e] shadow-sm"
                        : "bg-[#f5f0eb] border-2 border-dashed border-[#e8e0d8]"
                    }`}
                  >
                    {i < stamps && (
                      <Star
                        size={14}
                        className="text-[#c8843a] fill-[#c8843a]"
                      />
                    )}
                    {i === STAMPS_PER_CARD - 1 && i >= stamps && (
                      <Gift size={14} className="text-[#e8e0d8]" />
                    )}
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#f5f0eb] rounded-full h-2 mb-2">
                <div
                  className="bg-[#1a4d2e] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(progress * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-center text-[#6b5e52]">
                {stamps === 0
                  ? "注文するとスタンプが貯まります"
                  : stamps >= STAMPS_PER_CARD
                  ? "おめでとうございます！1品プレゼント！"
                  : `あと${remaining}個で無料ドリンクプレゼント`}
              </p>
            </>
          )}
        </div>

        {/* Streak card - Coke ON challenge style */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={20} className="text-orange-500" />
            <h2 className="font-bold text-[#1a1a1a]">連続注文チャレンジ</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {[1, 3, 7, 14, 30].map((milestone) => (
              <div
                key={milestone}
                className={`flex-shrink-0 rounded-xl p-3 text-center w-16 ${
                  streak >= milestone
                    ? "bg-[#1a4d2e] text-white"
                    : "bg-[#f5f0eb] text-[#6b5e52]"
                }`}
              >
                <Flame
                  size={16}
                  className={`mx-auto mb-1 ${streak >= milestone ? "text-[#c8843a] fill-[#c8843a]" : "text-[#e8e0d8]"}`}
                />
                <p className="text-xs font-bold">{milestone}日</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#6b5e52] mt-3">
            {streak === 0
              ? "毎日注文して連続記録を作ろう！"
              : `現在${streak}日連続！継続中`}
          </p>
        </div>

        {/* Info */}
        <div className="bg-[#f5f0eb] rounded-2xl p-4 text-xs text-[#6b5e52]">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} />
            <span className="font-bold">スタンプ獲得ルール</span>
          </div>
          <ul className="space-y-1 pl-4 list-disc">
            <li>1回の注文で1スタンプ獲得</li>
            <li>{STAMPS_PER_CARD}スタンプ達成でパン1品無料</li>
            <li>連続日数は毎日の注文で加算</li>
            <li>スタンプは達成後にリセットされます</li>
          </ul>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
