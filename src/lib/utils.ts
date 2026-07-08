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

const JST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const JST_WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Reads wall-clock JST values regardless of the host system's timezone
// (the server may run in UTC, e.g. on Railway, while the bakery operates on JST)
function getJstParts(date: Date) {
  const values: Record<string, string> = {};
  for (const part of JST_FORMATTER.formatToParts(date)) {
    values[part.type] = part.value;
  }
  return {
    isoDate: `${values.year}-${values.month}-${values.day}`,
    hour: parseInt(values.hour, 10) % 24,
    minute: parseInt(values.minute, 10),
    day: JST_WEEKDAYS[values.weekday] ?? date.getDay(),
  };
}

// 営業日：月〜金（土日祝は休業）
export function isBusinessDay(date: Date = new Date()): boolean {
  const { day, isoDate } = getJstParts(date);
  if (day === 0 || day === 6) return false;
  return !holidayJp.isHoliday(isoDate);
}

// 営業時間：営業日の 11:00〜15:00（日本時間基準）
export function isWithinSalesHours(date: Date = new Date()): boolean {
  if (!isBusinessDay(date)) return false;
  const { hour, minute } = getJstParts(date);
  const totalMin = hour * 60 + minute;
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
