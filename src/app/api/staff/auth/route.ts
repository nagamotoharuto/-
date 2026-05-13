import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body as { password: string };

    if (!password) {
      return NextResponse.json(
        { error: "password is required" },
        { status: 400 }
      );
    }

    const staffPassword = process.env.STAFF_PASSWORD ?? "bakery2024";
    const success = password === staffPassword;

    return NextResponse.json({ success });
  } catch (error) {
    console.error("POST /api/staff/auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
