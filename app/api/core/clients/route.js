import { NextResponse } from "next/server";
import { getCoreClientsData } from "../../../../lib/server-data";

export async function GET(request) {
  try {
    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = Number(limitRaw);
    const data = await getCoreClientsData({
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
        message: error.message || "Core clients API failed"
      },
      { status: 500 }
    );
  }
}
