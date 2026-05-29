import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  label: string;
  number: number;
}

const STEPS: Step[] = [
  { number: 1, label: "商品選択" },
  { number: 2, label: "時間指定" },
  { number: 3, label: "確認・注文" },
];

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-4">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                step.number < current
                  ? "bg-[#8B1A2C] text-white"
                  : step.number === current
                  ? "bg-[#7EC8E3] text-white"
                  : "bg-[#e8e0d8] text-[#6b5e52]"
              )}
            >
              {step.number < current ? <Check size={14} /> : step.number}
            </div>
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                step.number === current ? "font-bold text-[#7EC8E3]" : "text-[#6b5e52]"
              )}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-12 mx-1 mb-5",
                step.number < current ? "bg-[#8B1A2C]" : "bg-[#e8e0d8]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}