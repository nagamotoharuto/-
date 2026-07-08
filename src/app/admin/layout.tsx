import { headers } from "next/headers";
import Link from "next/link";
import { MonitorSmartphone, Home } from "lucide-react";

const MOBILE_UA_PATTERN = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent") ?? "";
  const isMobile = MOBILE_UA_PATTERN.test(userAgent);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#8B1A2C] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-[#F0AA5A] rounded-full flex items-center justify-center mb-5">
          <MonitorSmartphone size={32} className="text-white" />
        </div>
        <h1 className="text-white text-lg font-black mb-2">この画面はPC専用です</h1>
        <p className="text-[#F5C0C8] text-sm mb-8 leading-relaxed">
          スタッフ管理画面は、スマートフォンやタブレットではご利用いただけません。
          <br />
          パソコンからアクセスしてください。
        </p>
        <Link
          href="/"
          className="flex items-center gap-1.5 bg-white text-[#8B1A2C] rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-[#F5C0C8] transition-colors"
        >
          <Home size={16} />
          ホームに戻る
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
