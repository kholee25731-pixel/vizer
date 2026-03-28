import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.OPENAI_API_KEY;
  const ok = typeof key === "string" && key.length > 0;
  return NextResponse.json({ ok });
}
