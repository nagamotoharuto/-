"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import OpinionList from "@/components/features/OpinionList";

/**
 * お客様からのご意見だけを集めた画面。
 *
 * 記録の画面に並べていたが、日が経つほど下に溜まって販売の数字が
 * 読みにくくなった。見たいときだけ開けるよう1枚に切り出している。
 */
export default function OpinionsPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col gap-3">
        <Link
          href="/admin/records"
          className="inline-flex items-center gap-1 text-sm font-bold text-[#8B1A2C] w-fit"
        >
          <ChevronLeft size={16} />
          記録にもどる
        </Link>

        <OpinionList />
      </div>
    </div>
  );
}
