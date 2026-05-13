import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function generateOrderNumber(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const xx = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${hh}${mm}${xx}`;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const orders = await db.order.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, userType, pickupTime, paymentMethod, items } = body as {
      nickname: string;
      userType: string;
      pickupTime: string;
      paymentMethod: string;
      items: { productId: string; quantity: number }[];
    };

    if (!nickname || !userType || !pickupTime || !paymentMethod || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: `商品が見つかりません` }, { status: 400 });
      }
      if (!product.isAvailable) {
        return NextResponse.json({ error: `「${product.name}」は現在販売停止中です` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `「${product.name}」の在庫が不足しています（残り${product.stock}個）` },
          { status: 400 }
        );
      }
    }

    const totalAmount = items.reduce((sum, item) => {
      return sum + productMap.get(item.productId)!.price * item.quantity;
    }, 0);

    // Generate unique order number
    let orderNumber = generateOrderNumber();
    for (let i = 0; i < 10; i++) {
      const existing = await db.order.findUnique({ where: { orderNumber } });
      if (!existing) break;
      orderNumber = generateOrderNumber();
    }

    // Decrement stock for each item (sequential, no interactive transaction needed)
    for (const item of items) {
      await db.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Create the order with all items
    const order = await db.order.create({
      data: {
        nickname,
        userType,
        pickupTime,
        paymentMethod,
        totalAmount,
        orderNumber,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: productMap.get(item.productId)!.price,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Update stamp card (outside transaction — stamp loss on error is acceptable)
    const today = getTodayString();
    const yesterday = getYesterdayString();
    const existingCard = await db.stampCard.findUnique({ where: { nickname } });

    if (!existingCard) {
      await db.stampCard.create({
        data: { nickname, stamps: 1, totalOrders: 1, streak: 1, lastOrderDate: today },
      });
    } else {
      const alreadyToday = existingCard.lastOrderDate === today;
      let newStamps = existingCard.stamps;
      let newStreak = existingCard.streak;

      if (!alreadyToday) {
        newStamps = existingCard.stamps + 1 >= 15 ? 0 : existingCard.stamps + 1;
        newStreak = existingCard.lastOrderDate === yesterday ? existingCard.streak + 1 : 1;
      }

      await db.stampCard.update({
        where: { nickname },
        data: { stamps: newStamps, totalOrders: { increment: 1 }, streak: newStreak, lastOrderDate: today },
      });
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: "注文の作成に失敗しました" }, { status: 500 });
  }
}
