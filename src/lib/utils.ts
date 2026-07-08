import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import holidayJp from "@holiday-jp/holiday_jp";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`;
}

export function generateOrderNumber(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(now.getHours())}${pad(now.getMinutes())}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`;
}

export function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 11; h <= 14; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 14 && m > 45) break;
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }
  slots.push("15:00");
  return slots;
}

export function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
}

// 営業日：月〜金（土日祝は休業）
export function isBusinessDay(date: Date = new Date()): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidayJp.isHoliday(date);
}

// 営業時間：営業日の 11:00〜15:00
export function isWithinSalesHours(date: Date = new Date()): boolean {
  if (!isBusinessDay(date)) return false;
  const totalMin = date.getHours() * 60 + date.getMinutes();
  return totalMin >= 11 * 60 && totalMin < 15 * 60;
}

export const USER_TYPE_LABELS: Record<string, string> = {
  student: "学生",
  nursing: "看護生",
  staff: "教職員",
  visitor: "一般来場者",
};

export const STAMPS_PER_CARD = 10;

export const BREAD_ORDER_LIMIT = 3;
