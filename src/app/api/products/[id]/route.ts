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

    const { stock, isAvailable, name, price, imageUrl, description } = body as {
      stock?: number;
      isAvailable?: boolean;
      name?: string;
      price?: number;
      imageUrl?: string;
      description?: string;
    };

    const updateData: {
      stock?: number;
      isAvailable?: boolean;
      name?: string;
      price?: number;
      imageUrl?: string;
      description?: string;
    } = {};
    if (stock !== undefined) updateData.stock = stock;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (name !== undefined && name.trim()) updateData.name = name.trim();
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
