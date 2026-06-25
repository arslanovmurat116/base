import { NextResponse } from "next/server";
import { getCoreStatisticsData } from "../../../../lib/server-data";

export async function GET() {
  try {
    const data = await getCoreStatisticsData();

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Core statistics API failed"
      },
      { status: 500 }
    );
  }
}
