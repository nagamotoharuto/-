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
  // Local test-drive override — set in .env only, never commit/deploy this as true.
  if (process.env.NEXT_PUBLIC_FORCE_SALES_OPEN === "true") return true;
  if (!isBusinessDay(date)) return false;
  const { hour, minute } = getJstParts(date);
  const totalMin = hour * 60 + minute;
  return totalMin >= 11 * 60 && totalMin < 15 * 60;
}

// ---- 予約可能日（前営業日〜当日） ----

// The bakery fixes each sale day's line-up and quantities on the previous
// business day, so reservations for a sale day open at that day's 11:00.
// Wednesday's stock is reservable from Tuesday 11:00; Monday's from Friday
// 11:00, because the weekend is closed.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" in JST, independent of the host system's timezone
export function toJstDateString(date: Date = new Date()): string {
  return getJstParts(date).isoDate;
}

// Midnight JST of the given ISO date, as a real instant (JST is UTC+9, no DST)
function jstDateStringToUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+09:00`);
}

export function getNextBusinessDay(date: Date = new Date()): string {
  let cursor = jstDateStringToUtc(toJstDateString(date));
  // A run of closed days is at most a long weekend plus holidays; 14 is ample.
  for (let i = 0; i < 14; i++) {
    cursor = new Date(cursor.getTime() + MS_PER_DAY);
    if (isBusinessDay(cursor)) return toJstDateString(cursor);
  }
  return toJstDateString(cursor);
}

export function getPreviousBusinessDay(date: Date = new Date()): string {
  let cursor = jstDateStringToUtc(toJstDateString(date));
  for (let i = 0; i < 14; i++) {
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
    if (isBusinessDay(cursor)) return toJstDateString(cursor);
  }
  return toJstDateString(cursor);
}

/**
 * The one sale date currently taking reservations.
 *
 * Today's session stays open until its last pickup slot passes (15:00). Once it
 * closes, reservations roll over to the next business day, so the evening after
 * a sale day is when the following day's bookings come in — which is also when
 * staff have finished deciding that day's line-up. Reservations therefore run
 * through the night and across the weekend, unlike the counter itself.
 */
export function getReservableDate(now: Date = new Date()): string {
  const today = toJstDateString(now);
  if (isBusinessDay(now) && getAvailableTimeSlots(today, now).length > 0) {
    return today;
  }
  return getNextBusinessDay(now);
}

export function getReservableDates(now: Date = new Date()): string[] {
  return [getReservableDate(now)];
}

export function formatJstDateLabel(isoDate: string, now: Date = new Date()): string {
  const [, month, day] = isoDate.split("-").map(Number);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][
    getJstParts(jstDateStringToUtc(isoDate)).day
  ];
  const today = toJstDateString(now);
  const suffix =
    isoDate === today ? "（本日）" : isoDate === getNextBusinessDay(now) ? "（次の営業日）" : "";
  return `${month}月${day}日（${weekday}）${suffix}`;
}

// 予約受付は営業時間と別。営業終了後も翌営業日分の予約を受け付けるため、
// 「店舗が開いているか」と「予約できるか」を分けて扱う。
export function isReservationOpen(now: Date = new Date()): boolean {
  return getAvailableTimeSlots(getReservableDate(now), now).length > 0;
}

// Time slots still bookable for a sale date: every slot for a future date,
// only slots later than the current time for today.
export function getAvailableTimeSlots(isoDate: string, now: Date = new Date()): string[] {
  const slots = getTimeSlots();
  if (isoDate !== toJstDateString(now)) return slots;
  const { hour, minute } = getJstParts(now);
  const nowMin = hour * 60 + minute;
  return slots.filter((slot) => {
    const [h, m] = slot.split(":").map(Number);
    return h * 60 + m > nowMin;
  });
}

// ---- 予約枠（発注数の70%） ----

// Only this share of a day's production is bookable in advance; the rest is
// held back on the shelf for walk-up customers.
export const RESERVATION_RATIO = 0.7;

export function getReservableQty(plannedQty: number): number {
  return Math.floor(Math.max(0, plannedQty) * RESERVATION_RATIO);
}

// ---- 未受取予約の自動解放 ----

// A reservation not collected this long after its pickup time is released
// back to the shelf for walk-up sale.
export const RELEASE_GRACE_MINUTES = 15;

// The instant a reservation for (date, time) becomes eligible for release
export function getReleaseDeadline(pickupDate: string, pickupTime: string): Date {
  const [h, m] = pickupTime.split(":").map(Number);
  const base = new Date(`${pickupDate}T00:00:00+09:00`);
  return new Date(base.getTime() + (h * 60 + m + RELEASE_GRACE_MINUTES) * 60_000);
}

export const USER_TYPE_LABELS: Record<string, string> = {
  student: "学生",
  nursing: "看護生",
  staff: "教職員",
  visitor: "一般来場者",
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "現金",
  cashless: "キャッシュレス",
  // Retained so orders placed before the cashless consolidation still render
  paypay: "PayPay",
};

export const STAMPS_PER_CARD = 10;

export const BREAD_ORDER_LIMIT = 3;

// ---- 売り場の区分 ----

// 売り場は food / drink / goods の3つ。パンとお菓子はどちらも food で、
// 内訳は subCategory ("bread" | "sweets") で区別する。
export const CATEGORIES = ["food", "drink", "goods"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  food: "パン・お菓子",
  drink: "ドリンク",
  goods: "大学グッズ",
  // 区分を統合する前の予約データが残っていても表示できるようにしておく
  bread: "パン",
};

export const SUB_CATEGORIES = ["bread", "sweets"] as const;

export const SUB_CATEGORY_LABELS: Record<string, string> = {
  bread: "パン",
  sweets: "お菓子",
};

// パンかどうか。図鑑・購入上限・スタンプ特典・AIカメラのカウントはパンだけが対象。
// 区分統合前のデータは category 自体が "bread" だったので、そちらも拾う。
export function isBread(item: { category: string; subCategory?: string | null }): boolean {
  return item.subCategory === "bread" || item.category === "bread";
}
