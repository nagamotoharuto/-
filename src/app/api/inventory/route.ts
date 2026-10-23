import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { compareProducts } from "@/lib/utils";
import { requireStaff } from "@/lib/staffAuth";

export async function GET(request: NextRequest) {
  const denied = requireStaff(request);
  if (denied) return denied;

  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        imageUrl: true,
        stock: true,
        isAvailable: true,
        subCategory: true,
        description: true,
        updatedAt: true,
      },
    });

    // パンを先、お菓子を後にして名前順。画面ごとに並びがぶれないようここで揃える。
    return NextResponse.json([...products].sort(compareProducts));
  } catch (error) {
    console.error("GET /api/inventory error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const denied = requireStaff(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { productId, stock } = body as { productId: string; stock: number };

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    if (stock === undefined || stock === null) {
      return NextResponse.json(
        { error: "stock is required" },
        { status: 400 }
      );
    }

    if (typeof stock !== "number" || stock < 0 || !Number.isInteger(stock)) {
      return NextResponse.json(
        { error: "stock must be a non-negative integer" },
        { status: 400 }
      );
    }

    const product = await db.product.update({
      where: { id: productId },
      data: { stock },
    });

    return NextResponse.json(product);
  } catch (error: unknown) {
    console.error("PATCH /api/inventory error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update stock" },
      { status: 500 }
    );
  }
}
