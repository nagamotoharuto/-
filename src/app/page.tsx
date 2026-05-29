"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChefHat, ShoppingBag, Clock, CheckCircle, ArrowRight, MapPin, Lock } from "lucide-react";
import { useBakeryStore } from "@/lib/store";
import BottomNav from "@/components/features/BottomNav";

const USER_TYPES = [
  { value: "student", label: "学生" },
  { value: "nursing", label: "看護生" },
  { value: "staff", label: "教職員" },
  { value: "visitor", label: "一般来場者" },
];

export default function HomePage() {
  const router = useRouter();
  const { user, setUser } = useBakeryStore();
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [userType, setUserType] = useState(user?.userType ?? "student");
  const [error, setError] = useState("");

  function handleStart() {
    if (!nickname.trim()) {
      setError("ニックネームを入力してください");
      return;
    }
    setUser({ nickname: nickname.trim(), userType });
    router.push("/menu");
  }

  return (
    <div className="min-h-screen bg-[#fdf8f3] flex flex-col pb-20">
      {/* Hero */}
      <div className="bg-[#1B3A6B] text-white px-4 pt-12 pb-10">
        <div className="max-w-md mx-auto text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#F2DC8F] rounded-full flex items-center justify-center">
              <ChefHat size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-wide mb-1">University Bakery</h1>
          <p className="text-sm text-[#A8C8F0] mb-4">事前予約サービス</p>
          <div className="flex items-center justify-center gap-2 text-xs bg-white/10 rounded-lg px-4 py-2">
            <MapPin size={12} />
            <span>1F 正面玄関前　営業時間 11:00〜15:00</span>
          </div>
        </div>
      </div>

      {/* 3-step flow */}
      <div className="max-w-md mx-auto w-full px-4 py-6">
        <p className="text-center text-xs font-bold text-[#6b5e52] uppercase tracking-widest mb-4">
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
              <p className="text-xs font-black text-[#F2DC8F] mb-2">STEP {step}</p>
              <Icon size={28} className="mx-auto text-[#1B3A6B] mb-2" />
              <p className="text-xs font-bold text-[#1a1a1a] leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* User setup */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e8e0d8] p-6">
          <h2 className="text-base font-bold mb-4 text-[#1a1a1a]">はじめに教えてください</h2>

          <div className="mb-4">
            <label className="block text-xs font-bold text-[#6b5e52] mb-1">
              ニックネーム
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
              placeholder="例：たろう"
              maxLength={20}
              className="w-full border border-[#e8e0d8] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] bg-[#fdf8f3]"
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
                      ? "bg-[#1B3A6B] text-white border-[#1B3A6B]"
                      : "bg-white text-[#1a1a1a] border-[#e8e0d8] hover:border-[#1B3A6B]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-[#1B3A6B] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-base hover:bg-[#2E5BA8] transition-colors active:scale-95"
          >
            メニューを見る
            <ArrowRight size={18} />
          </button>
        </div>

        <p className="text-center text-xs text-[#6b5e52] mt-4">
          お受け取りは <strong>1F 正面玄関前</strong> にて
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href="/staff"
            className="flex items-center gap-1.5 text-xs text-[#6b5e52] hover:text-[#1B3A6B] transition-colors py-2 px-4 rounded-xl hover:bg-[#e8e0d8]"
          >
            <Lock size={12} />
            スタッフ管理画面
          </Link>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}