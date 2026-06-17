import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, price, imageUrl, stock, description } = body as {
      name: string;
      category: string;
      price: number;
      imageUrl: string;
      stock: number;
      description: string;
    };

    if (!name?.trim() || !category || !price || price <= 0) {
      return NextResponse.json({ error: "必須項目が入力されていません" }, { status: 400 });
    }

    const id = `prod_${category}_${Date.now()}`;
    const product = await db.product.create({
      data: {
        id,
        name: name.trim(),
        category,
        price,
        imageUrl: imageUrl || "",
        stock: stock ?? 0,
        description: description || "",
        isAvailable: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "商品の作成に失敗しました" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const products = await db.product.findMany({
      where: category ? { category } : undefined,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
