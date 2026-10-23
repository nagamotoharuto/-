/**
 * 合言葉の入力回数を制限する。
 *
 * 短い合言葉は総当たりで破られる。4桁なら1万通りしかなく、制限が
 * 無ければ数分で当てられてしまう。間違いが続いた接続元をしばらく
 * 締め出すことで、短い合言葉でも実用に耐えるようにする。
 *
 * 記録は各サーバーの中だけに持つ。再起動すれば消えるが、総当たりは
 * 続けて試すものなので、それで用は足りる。
 */

// この回数まちがえたら締め出す。打ち間違いで締め出さない程度に取る。
const MAX_ATTEMPTS = 8;

// 間違いを数える期間と、締め出す時間
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 10 * 60 * 1000;

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, Entry>();

// 放っておくと際限なく増えるので、古い記録は折に触れて捨てる
const MAX_ENTRIES = 5000;

function sweep(now: number) {
  if (attempts.size < MAX_ENTRIES) return;
  for (const [key, e] of attempts) {
    if (e.lockedUntil < now && now - e.firstFailureAt > WINDOW_MS) attempts.delete(key);
  }
}

/** 接続元の見分け。経由地がある場合はいちばん手前のものを使う。 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}

/** いま締め出し中なら、あと何秒かを返す。通してよければ 0。 */
export function retryAfterSeconds(key: string, now: number = Date.now()): number {
  const entry = attempts.get(key);
  if (!entry || entry.lockedUntil <= now) return 0;
  return Math.ceil((entry.lockedUntil - now) / 1000);
}

export function recordFailure(key: string, now: number = Date.now()): void {
  sweep(now);
  const entry = attempts.get(key);

  // はじめての失敗、または数える期間が過ぎていたら数え直す
  if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
    attempts.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }

  entry.failures += 1;
  if (entry.failures >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS;
    entry.failures = 0;
    entry.firstFailureAt = now;
  }
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}

export const LOGIN_THROTTLE = { MAX_ATTEMPTS, WINDOW_MS, LOCK_MS };
