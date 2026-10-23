import { NextRequest, NextResponse } from "next/server";
import {
  attachStaffSession,
  clearStaffSession,
  issueStaffSession,
  safeEqual,
} from "@/lib/staffAuth";

/**
 * スタッフ専用画面の入口。
 *
 * 合言葉が合えば、署名付きの札をCookieに入れて返す。スタッフ用のAPIは
 * その札を見て通す。画面を開けたかどうかだけでなく、APIそのものを
 * 守るために必要。
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password: string };

    if (!password) {
      return NextResponse.json({ error: "合言葉を入力してください" }, { status: 400 });
    }

    // 合言葉が未設定のまま動かさない。以前はここに決め打ちの合言葉を
    // 書いていたが、公開しているソースから誰でも読めてしまうため外した。
    const staffPassword = process.env.STAFF_PASSWORD;
    if (!staffPassword) {
      console.error("STAFF_PASSWORD が設定されていません");
      return NextResponse.json(
        { error: "サーバーの設定が未完了です。管理者にご連絡ください" },
        { status: 503 }
      );
    }

    if (!safeEqual(password, staffPassword)) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const token = issueStaffSession();
    if (!token) {
      return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
    }

    return attachStaffSession(NextResponse.json({ success: true }), token);
  } catch (error) {
    console.error("POST /api/staff/auth error:", error);
    return NextResponse.json({ error: "ログインに失敗しました" }, { status: 500 });
  }
}

/** ログアウト。札を消す。 */
export async function DELETE() {
  return clearStaffSession(NextResponse.json({ success: true }));
}
