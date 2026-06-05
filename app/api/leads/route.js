import { NextResponse } from "next/server";
import { getLeadsData } from "../../../lib/server-data";

export async function GET() {
  const data = await getLeadsData();
  return NextResponse.json({
    ok: true,
    data
  });
}
