import { NextResponse } from "next/server";
import { getDashboardData } from "../../../lib/server-data";

export async function GET() {
  try {
    const data = await getDashboardData();
    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Dashboard API failed"
      },
      { status: 500 }
    );
  }
}
