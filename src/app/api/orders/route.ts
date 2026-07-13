import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BREAD_ORDER_LIMIT, isWithinSalesHours } from "@/lib/utils";


function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get("nickname");
    const orders = await db.order.findMany({
      where: nickname ? { nickname } : undefined,
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
    const { nickname, email, userType, pickupTime, paymentMethod, items } = body as {
      nickname: string;
      email: string;
      userType: string;
      pickupTime: string;
      paymentMethod: string;
      items: { productId: string; quantity: number }[];
    };

    if (!nickname || !userType || !pickupTime || !paymentMethod || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
    }

    if (!isWithinSalesHours()) {
      return NextResponse.json(
        { error: "現在は営業時間外です（平日11:00〜15:00）。営業時間内にご注文ください" },
        { status: 400 }
      );
    }

    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate stock and availability
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: "商品が見つかりません" }, { status: 400 });
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

    const requestedBreadTotal = items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return product?.category === "bread" ? sum + item.quantity : sum;
    }, 0);
    if (requestedBreadTotal > BREAD_ORDER_LIMIT) {
      return NextResponse.json(
        { error: `パンは1人${BREAD_ORDER_LIMIT}個までご注文いただけます` },
        { status: 400 }
      );
    }

    // Check for free bread eligibility (auto-applied server-side)
    const stampCard = await db.stampCard.findUnique({ where: { nickname } });
    let freeBreadDiscount = 0;
    let freeBreadName = "";
    if (stampCard?.freeItemAvailable) {
      const breadItems = items
        .map((item) => ({ item, product: productMap.get(item.productId)! }))
        .filter(({ product }) => product.category === "bread")
        .sort((a, b) => a.product.price - b.product.price);
      if (breadItems.length > 0) {
        freeBreadDiscount = breadItems[0].product.price;
        freeBreadName = breadItems[0].product.name;
      }
    }

    const baseTotal = items.reduce((sum, item) => {
      return sum + productMap.get(item.productId)!.price * item.quantity;
    }, 0);
    const totalAmount = Math.max(0, baseTotal - freeBreadDiscount);

    // Generate sequential order number
    const count = await db.order.count();
    const orderNumber = String(count + 1);

    // Decrement stock
    for (const item of items) {
      await db.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Create order
    const order = await db.order.create({
      data: {
        nickname,
        email,
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

    // Update stamp card
    const today = getTodayString();
    const yesterday = getYesterdayString();

    // Bonus stamp: bread qty ≥ 3 OR goods qty ≥ 1 in this order
    const breadTotal = items.reduce((sum, item) => {
      const p = productMap.get(item.productId);
      return p?.category === "bread" ? sum + item.quantity : sum;
    }, 0);
    const goodsTotal = items.reduce((sum, item) => {
      const p = productMap.get(item.productId);
      return p?.category === "goods" ? sum + item.quantity : sum;
    }, 0);
    const bonusStamp = breadTotal >= 3 || goodsTotal >= 1 ? 1 : 0;

    if (!stampCard) {
      const isNewDay = true;
      const baseStamp = 1;
      const stampsToAdd = baseStamp + bonusStamp;
      const reachedGoal = stampsToAdd >= 10;
      await db.stampCard.create({
        data: {
          nickname,
          stamps: reachedGoal ? stampsToAdd - 10 : stampsToAdd,
          totalOrders: 1,
          streak: 1,
          lastOrderDate: today,
          freeItemAvailable: reachedGoal,
        },
      });
    } else {
      const isNewDay = stampCard.lastOrderDate !== today;
      const baseStamp = isNewDay ? 1 : 0;
      const stampsToAdd = baseStamp + bonusStamp;
      const rawStamps = stampCard.stamps + stampsToAdd;
      const reachedGoal = rawStamps >= 10;
      const newStamps = reachedGoal ? rawStamps - 10 : rawStamps;
      const newStreak = isNewDay
        ? stampCard.lastOrderDate === yesterday ? stampCard.streak + 1 : 1
        : stampCard.streak;

      await db.stampCard.update({
        where: { nickname },
        data: {
          stamps: newStamps,
          totalOrders: { increment: 1 },
          streak: newStreak,
          lastOrderDate: isNewDay ? today : stampCard.lastOrderDate,
          // Set to true if reached goal; clear if we just used a free bread
          freeItemAvailable: freeBreadDiscount > 0 ? reachedGoal : (reachedGoal || stampCard.freeItemAvailable),
        },
      });
    }

    return NextResponse.json({ ...order, freeBreadName: freeBreadName || null }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: "注文の作成に失敗しました" }, { status: 500 });
  }
}
