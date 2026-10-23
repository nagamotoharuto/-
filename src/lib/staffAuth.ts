import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * スタッフ専用APIの出入口。
 *
 * これまで合言葉は画面を開くときにしか確かめておらず、APIそのものは
 * 誰でも叩ける状態だった。予約の取得はお名前とメールアドレスを返すため、
 * 住所を知っていれば外から読めてしまっていた。ここで塞ぐ。
 *
 * 合言葉が合ったときに署名付きの札をCookieに入れ、スタッフ用のAPIは
 * その札を確かめる。札は合言葉から作った鍵で署名するので、合言葉を
 * 変えれば古い札はすべて無効になる。
 */

export const STAFF_COOKIE = "staff_session";

// 札の有効期間。閉店後に開きっぱなしの端末が残っても、翌日には切れる。
const SESSION_HOURS = 12;

function secret(): string | null {
  const password = process.env.STAFF_PASSWORD;
  if (!password) return null;
  // 合言葉そのものを署名鍵にしない。札が漏れても合言葉を推測されないように。
  return createHmac("sha256", "sanjo-bakery/staff-session").update(password).digest("hex");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("hex");
}

/** 合言葉が合ったときに渡す札。期限と署名だけで、中身は持たせない。 */
export function issueStaffSession(now: Date = new Date()): string | null {
  const key = secret();
  if (!key) return null;
  const expires = now.getTime() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${sign(payload, key)}`;
}

/** 長さの違う文字列でも時間差が出ないように比べる。 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // 長さが違う時点で不一致だが、比較そのものは走らせて時間を揃える
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function isValidSession(token: string | undefined, now: Date): boolean {
  if (!token) return false;
  const key = secret();
  if (!key) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload, key))) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > now.getTime();
}

export function hasStaffSession(request: NextRequest, now: Date = new Date()): boolean {
  return isValidSession(request.cookies.get(STAFF_COOKIE)?.value, now);
}

/**
 * スタッフ専用の処理の先頭で呼ぶ。
 * 通してよければ null、だめなら返すべき応答を返す。
 */
export function requireStaff(request: NextRequest): NextResponse | null {
  if (!process.env.STAFF_PASSWORD) {
    console.error("STAFF_PASSWORD が設定されていません");
    return NextResponse.json(
      { error: "サーバーの設定が未完了です。管理者にご連絡ください" },
      { status: 503 }
    );
  }
  if (hasStaffSession(request)) return null;
  return NextResponse.json(
    { error: "スタッフ専用画面にログインしてください" },
    { status: 401 }
  );
}

/** 札をCookieに載せる。画面側のJavaScriptからは読めないようにする。 */
export function attachStaffSession(response: NextResponse, token: string): NextResponse {
  response.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return response;
}

export function clearStaffSession(response: NextResponse): NextResponse {
  response.cookies.set(STAFF_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
