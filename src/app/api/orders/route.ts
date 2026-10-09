import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  BREAD_BONUS_THRESHOLD,
  BREAD_ORDER_LIMIT,
  getAvailableTimeSlots,
  getReservableDate,
  isBread,
  STAMPS_PER_CARD,
  toJstDateString,
} from "@/lib/utils";
import { getAvailability, releaseOverdueReservations } from "@/lib/availability";

const PAYMENT_METHODS = ["cash", "cashless"];

function getTodayString(): string {
  return toJstDateString();
}

function getYesterdayString(): string {
  return toJstDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
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
    const { nickname, email, userType, pickupDate, pickupTime, paymentMethod, items } = body as {
      nickname: string;
      email: string;
      userType: string;
      pickupDate: string;
      pickupTime: string;
      paymentMethod: string;
      items: { productId: string; quantity: number }[];
    };

    if (!nickname || !userType || !pickupDate || !pickupTime || !paymentMethod || !items?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: "お支払い方法を選択してください" }, { status: 400 });
    }

    // Exactly one sale date takes reservations at a time: today's until the
    // counter closes, then the next business day's. Reservations themselves are
    // accepted around the clock, including after hours and over the weekend.
    if (pickupDate !== getReservableDate()) {
      return NextResponse.json(
        { error: "その日付は現在ご予約いただけません。受け取り日を選び直してください" },
        { status: 400 }
      );
    }

    if (!getAvailableTimeSlots(pickupDate).includes(pickupTime)) {
      return NextResponse.json(
        { error: "その受け取り時間はすでに過ぎています。時間を選び直してください" },
        { status: 400 }
      );
    }

    // Hand back any no-show reservations first so their slots count as free here
    await releaseOverdueReservations();

    const productIds = items.map((i) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const availability = await getAvailability(pickupDate);
    const availabilityMap = new Map(availability.map((a) => [a.id, a]));

    // Validate against the sale date's reservation quota (発注数の70%)
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: "商品が見つかりません" }, { status: 400 });
      }
      if (!product.isAvailable) {
        return NextResponse.json({ error: `「${product.name}」は現在販売停止中です` }, { status: 400 });
      }
      const slot = availabilityMap.get(item.productId);
      if (!slot?.isOffered) {
        return NextResponse.json(
          { error: `「${product.name}」はこの日の販売予定に入っていません` },
          { status: 400 }
        );
      }
      if (slot.remainingQty < item.quantity) {
        return NextResponse.json(
          {
            error: `「${product.name}」の予約枠が不足しています（予約可能残り${slot?.remainingQty ?? 0}個）`,
          },
          { status: 400 }
        );
      }
    }

    const requestedBreadTotal = items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return product && isBread(product) ? sum + item.quantity : sum;
    }, 0);
    if (requestedBreadTotal > BREAD_ORDER_LIMIT) {
      return NextResponse.json(
        { error: `パンは1人${BREAD_ORDER_LIMIT}個までご注文いただけます` },
        { status: 400 }
      );
    }

    const stampCard = await db.stampCard.findUnique({ where: { nickname } });

    // 特典は製作者が個別に渡す形になったため、注文時の割引はない
    const totalAmount = items.reduce((sum, item) => {
      return sum + productMap.get(item.productId)!.price * item.quantity;
    }, 0);

    // Generate sequential order number
    const count = await db.order.count();
    const orderNumber = String(count + 1);

    // Product.stock is the live shelf count, maintained by the camera's AI count
    // — it is deliberately NOT decremented here. A reservation consumes a slot
    // out of the sale date's quota, which is derived from the orders themselves,
    // so cancelling or releasing an order gives the slot straight back.

    // Create order
    const order = await db.order.create({
      data: {
        nickname,
        email,
        userType,
        pickupDate,
        pickupTime,
        paymentMethod,
        totalAmount,
        orderNumber,
        items: {
          create: items.map((item) => {
            const product = productMap.get(item.productId)!;
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: product.price,
              name: product.name,
              imageUrl: product.imageUrl,
              category: product.category,
              subCategory: product.subCategory,
            };
          }),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // スタンプの加算
    // 1日1回の注文で1個。中身は問わない。パンを3個以上買うとさらに1個。
    const today = getTodayString();
    const yesterday = getYesterdayString();

    const breadTotal = items.reduce((sum, item) => {
      const p = productMap.get(item.productId);
      return p && isBread(p) ? sum + item.quantity : sum;
    }, 0);
    const bonusStamp = breadTotal >= BREAD_BONUS_THRESHOLD ? 1 : 0;

    const isNewDay = stampCard ? stampCard.lastOrderDate !== today : true;
    const stampsToAdd = (isNewDay ? 1 : 0) + bonusStamp;
    const rawStamps = (stampCard?.stamps ?? 0) + stampsToAdd;

    // 満了したら新しいカードに切り替える。1回の注文で2枚満了することは
    // まずないが、繰り上がりが残らないよう割り算で処理する。
    const completedNow = Math.floor(rawStamps / STAMPS_PER_CARD);
    const newStamps = rawStamps % STAMPS_PER_CARD;

    const newStreak = !stampCard
      ? 1
      : isNewDay
      ? stampCard.lastOrderDate === yesterday
        ? stampCard.streak + 1
        : 1
      : stampCard.streak;

    await db.stampCard.upsert({
      where: { nickname },
      create: {
        nickname,
        stamps: newStamps,
        totalOrders: 1,
        streak: 1,
        lastOrderDate: today,
      },
      update: {
        stamps: newStamps,
        totalOrders: { increment: 1 },
        streak: newStreak,
        lastOrderDate: isNewDay ? today : stampCard!.lastOrderDate,
      },
    });

    // 満了したカードは1枚ずつ残す。お客様が製作者に見せるための記録。
    if (completedNow > 0) {
      const already = await db.stampCardCompletion.count({ where: { nickname } });
      await db.stampCardCompletion.createMany({
        data: Array.from({ length: completedNow }, (_, i) => ({
          nickname,
          cardNumber: already + i + 1,
        })),
      });
    }

    return NextResponse.json({ ...order, completedCards: completedNow }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ error: "注文の作成に失敗しました" }, { status: 500 });
  }
}
