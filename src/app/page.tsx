"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, ShoppingBag, Clock, CheckCircle, ArrowRight, MapPin } from "lucide-react";
import { useBakeryStore } from "@/lib/store";
import BottomNav from "@/components/features/BottomNav";
import { isWithinSalesHours } from "@/lib/utils";

const USER_TYPES = [
  { value: "student", label: "学生" },
  { value: "nursing", label: "看護生" },
  { value: "staff", label: "教職員" },
  { value: "visitor", label: "一般来場者" },
];

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useBakeryStore();
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState(user?.userType ?? "student");
  const [error, setError] = useState("");
  const [storeOpen, setStoreOpen] = useState(() => isWithinSalesHours());

  useEffect(() => {
    const id = setInterval(() => setStoreOpen(isWithinSalesHours()), 30_000);
    return () => clearInterval(id);
  }, []);

  function handleStart() {
    if (!fullName.trim()) {
      setError("フルネーム（カタカナ）を入力してください");
      return;
    }
    setUser({ nickname: fullName.trim(), userType });
    if (!isWithinSalesHours()) {
      setError("現在は営業時間外です。営業日（月〜金）11:00〜15:00にご利用ください");
      return;
    }
    router.push("/menu");
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
      {/* Hero */}
      <div className="bg-[#8B1A2C] text-white px-4 pt-12 pb-10">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#F0AA5A] rounded-full flex items-center justify-center">
              <ChefHat size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-wide mb-1">University Bakery</h1>
          <p className="text-sm text-[#A8C8F0] mb-4">事前予約サービス</p>
          <div className="flex items-center justify-center gap-2 text-xs bg-white/10 rounded-lg px-4 py-2 mb-2">
            <MapPin size={12} />
            <span>1F 正面玄関前　営業時間 平日11:00〜15:00</span>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
              storeOpen ? "bg-green-500/20 text-green-100" : "bg-white/20 text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${storeOpen ? "bg-green-300" : "bg-gray-300"}`} />
            {storeOpen ? "只今営業中" : "只今営業時間外（土日祝・平日15:00〜11:00は休業）"}
          </div>
        </div>
      </div>

      {/* 3-step flow */}
      <div className="max-w-md mx-auto w-full px-4 py-6">
        <p className="text-center text-xs font-bold text-red-600 uppercase tracking-widest mb-4">
          ラクラク 3 ステップ
        </p>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: ShoppingBag, label: "商品を選ぶ", step: "01" },
            { icon: Clock, label: "時間を指定", step: "02" },
            { icon: CheckCircle, label: "予約完了", step: "03" },
          ].map(({ icon: Icon, label, step }) => (
            <div
              key={step}
              className="bg-white rounded-2xl p-4 text-center shadow-sm border border-[#e8e0d8]"
            >
              <p className="text-xs font-black text-[#F0AA5A] mb-2">STEP {step}</p>
              <Icon size={28} className="mx-auto text-[#8B1A2C] mb-2" />
              <p className="text-xs font-bold text-[#1a1a1a] leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* User setup */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e8e0d8] p-6">
          <h2 className="text-base font-bold mb-4 text-[#1a1a1a]">はじめに教えてください</h2>

          <div className="mb-4">
            <label className="block text-base font-black text-[#D8232A] mb-1.5">
              フルネーム（カタカナ）<span className="text-xs font-bold align-top">必須</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setError("");
              }}
              placeholder="例：ヤマダ タロウ"
              maxLength={30}
              className="w-full border border-[#e8e0d8] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-[#fdf8f3]"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-[#6b5e52] mb-2">区分</label>
            <div className="grid grid-cols-2 gap-2">
              {USER_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setUserType(t.value)}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    userType === t.value
                      ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                      : "bg-white text-[#1a1a1a] border-[#e8e0d8] hover:border-[#8B1A2C]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-[#8B1A2C] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-base hover:bg-[#A52235] transition-colors active:scale-95"
          >
            メニューを見る
            <ArrowRight size={18} />
          </button>
        </div>

        <p className="text-center text-xs text-[#6b5e52] mt-4">
          お受け取りは <strong>1F 正面玄関前</strong> にて
        </p>
      </div>

      <BottomNav />
    </div>
  );
}