import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 商品写真の配信。idは1枚ごとに固有で、中身が差し替わることはないので長期キャッシュできる。
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const image = await db.productImage.findUnique({
      where: { id },
      select: { data: true, mimeType: true },
    });

    if (!image) {
      return NextResponse.json({ error: "画像が見つかりません" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(image.data), {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/images/[id] error:", error);
    return NextResponse.json({ error: "画像の取得に失敗しました" }, { status: 500 });
  }
}
