import { NextResponse } from "next/server";
import { getShelfCount } from "@/lib/shelfCount";

export async function GET() {
  const result = await getShelfCount();
  return NextResponse.json(result);
}
