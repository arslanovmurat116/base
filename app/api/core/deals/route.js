import { NextResponse } from "next/server";
import { getCoreDealsData } from "../../../../lib/server-data";

export async function GET(request) {
  try {
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = Number(limitRaw);
    const data = await getCoreDealsData({
      limit: Number.isFinite(limit) ? limit : undefined
    });

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Core deals API failed"
      },
      { status: 500 }
    );
  }
}
