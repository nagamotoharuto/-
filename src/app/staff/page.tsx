"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChefHat, Eye, EyeOff } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("staff_auth", "1");
        router.push("/staff/dashboard");
      } else {
        setError("パスワードが正しくありません");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a4d2e] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#c8843a] rounded-full flex items-center justify-center mx-auto mb-3">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-white text-xl font-black">スタッフ管理画面</h1>
          <p className="text-green-200 text-sm mt-1">学内ベーカリー</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={18} className="text-[#6b5e52]" />
            <h2 className="font-bold text-[#1a1a1a]">スタッフ専用ログイン</h2>
          </div>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                パスワード
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="パスワードを入力"
                  className="w-full border border-[#e8e0d8] rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4d2e] bg-[#fdf8f3]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b5e52]"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-[#1a4d2e] text-white rounded-xl py-3 font-bold disabled:opacity-60 hover:bg-[#2d6b42] transition-colors"
            >
              {loading ? "確認中..." : "ログイン"}
            </button>
          </form>

          <p className="text-xs text-[#6b5e52] text-center mt-4">
            このページはスタッフのみが使用できます
          </p>
        </div>
      </div>
    </div>
  );
}
