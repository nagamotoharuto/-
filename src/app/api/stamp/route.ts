import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get("nickname");

    if (!nickname) {
      return NextResponse.json(
        { error: "nickname query parameter is required" },
        { status: 400 }
      );
    }

    // Upsert: return existing card or create a fresh one
    const stampCard = await db.stampCard.upsert({
      where: { nickname },
      update: {}, // no update on read
      create: {
        nickname,
        stamps: 0,
        totalOrders: 0,
        streak: 0,
        lastOrderDate: "",
      },
    });

    return NextResponse.json(stampCard);
  } catch (error) {
    console.error("GET /api/stamp error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stamp card" },
      { status: 500 }
    );
  }
}
