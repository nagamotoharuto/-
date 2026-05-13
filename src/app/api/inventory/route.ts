import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest) {
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
        description: true,
        updatedAt: true,
      },
      orderBy: { category: "asc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/inventory error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
