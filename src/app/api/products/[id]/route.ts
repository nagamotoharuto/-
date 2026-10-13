import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { stock, isAvailable, name, price, imageUrl, description, subCategory } = body as {
      stock?: number;
      isAvailable?: boolean;
      name?: string;
      subCategory?: string;
      price?: number;
      imageUrl?: string;
      description?: string;
    };

    const updateData: {
      stock?: number;
      isAvailable?: boolean;
      name?: string;
      subCategory?: string;
      price?: number;
      imageUrl?: string;
      description?: string;
    } = {};
    if (stock !== undefined) updateData.stock = stock;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (name !== undefined && name.trim()) updateData.name = name.trim();
    if (subCategory !== undefined) updateData.subCategory = subCategory;
    if (price !== undefined && price > 0) updateData.price = price;
    if (imageUrl !== undefined && imageUrl.trim()) updateData.imageUrl = imageUrl.trim();
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const product = await db.product.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(product);
  } catch (error: unknown) {
    console.error("PATCH /api/products/[id] error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * 商品を削除する。
 *
 * 削除すると発注数(DailyStock)と飛び込み販売(WalkInSale)の記録も一緒に消え、
 * 予約明細があるものはDBの制約で削除できない。研究データを欠損させないため、
 * 一度でも売れた・予約された商品は消さず、販売停止にするよう促す。
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    const [orderItems, walkInSales, dailyStocks] = await Promise.all([
      db.orderItem.count({ where: { productId: id } }),
      db.walkInSale.count({ where: { productId: id } }),
      db.dailyStock.count({ where: { productId: id, plannedQty: { gt: 0 } } }),
    ]);

    if (orderItems > 0 || walkInSales > 0) {
      return NextResponse.json(
        {
          error:
            `「${product.name}」は販売の記録が残っているため削除できません。` +
            `「販売中」を切り替えて停止中にしてください`,
        },
        { status: 409 }
      );
    }

    if (dailyStocks > 0) {
      return NextResponse.json(
        {
          error:
            `「${product.name}」は発注数が入っている日があります。` +
            `先にその日の発注数を0にしてから削除してください`,
        },
        { status: 409 }
      );
    }

    // 写真はDBに置いてあるので、商品と一緒に片付ける
    const imageId = product.imageUrl.match(/^\/api\/images\/([0-9a-z]+)$/i)?.[1];

    await db.product.delete({ where: { id } });
    if (imageId) {
      await db.productImage.deleteMany({ where: { id: imageId } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
