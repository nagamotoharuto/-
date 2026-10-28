import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resyncSoldOutForOrders } from "@/lib/availability";
import { hasStaffSession, requireStaff } from "@/lib/staffAuth";

// "released" = 未受取のまま受け取り時間を過ぎ、店頭販売に戻した予約
const VALID_STATUSES = ["pending", "ready", "completed", "cancelled", "released"] as const;
type OrderStatus = (typeof VALID_STATUSES)[number];

/**
 * 予約1件の取得。
 *
 * 予約を終えたお客様が見る確認画面がここを読む。予約番号は推測できない
 * 文字列なので、番号を持っている本人だけが開ける。スタッフでなければ
 * 開けない作りにしていたが、それでは予約した本人が確認画面を開けず、
 * 送信のあとに「注文が見つかりませんでした」と出てしまっていた。
 *
 * ただしメールアドレスは確認画面では使わない。番号を知る人なら誰でも
 * 読めてしまう場所に置く必要がないので、スタッフ以外には返さない。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!hasStaffSession(request)) {
      const { email: _email, ...rest } = order;
      return NextResponse.json(rest);
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireStaff(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: OrderStatus };

    if (!status) {
      return NextResponse.json(
        { error: "status field is required" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const order = await db.order.update({
      where: { id },
      data: {
        status,
        // Stamp the moment staff hand the items back to the shelf, and clear it
        // again if a release is undone.
        releasedAt: status === "released" ? new Date() : null,
      },
      include: {
        items: { include: { product: true } },
      },
    });

    // 取り置き・受け渡し・解放のどれでも棚の残数が動く。売り切れの記録を
    // その場で合わせておく。
    await resyncSoldOutForOrders([order.id]);

    return NextResponse.json(order);
  } catch (error: unknown) {
    console.error("PATCH /api/orders/[id] error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
