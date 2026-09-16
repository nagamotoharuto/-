import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// 取り込み時に縮小するので、元ファイルは大きめでも受け付ける
const MAX_UPLOAD_SIZE = 12 * 1024 * 1024;
// 商品カードに出る大きさに対して十分な幅。これ以上は情報量にならない。
const MAX_WIDTH = 1200;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "JPEG・PNG・WebP・GIF のみアップロードできます" },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "ファイルサイズは12MB以下にしてください" }, { status: 400 });
    }

    const original = Buffer.from(await file.arrayBuffer());

    // スマホで撮った写真は向きがExifにしか入っていないことがあるので rotate() で焼き込む。
    // WebPに揃えると透過も保てて、DBに置いても軽い。
    let data: Buffer;
    try {
      data = await sharp(original)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { error: "画像を読み込めませんでした。別のファイルでお試しください" },
        { status: 400 }
      );
    }

    const image = await db.productImage.create({
      data: {
        data: new Uint8Array(data),
        mimeType: "image/webp",
        byteSize: data.byteLength,
      },
      select: { id: true },
    });

    return NextResponse.json({ url: `/api/images/${image.id}` });
  } catch (error) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }
}
