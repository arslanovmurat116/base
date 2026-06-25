import { NextResponse } from "next/server";
import { getAICRMSummary } from "../../../../../lib/server-data";

export async function GET() {
  try {
    const result = await getAICRMSummary();

    return NextResponse.json(result, {
      status: result.ok ? 200 : 500
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "AI CRM assistant API failed"
      },
      { status: 500 }
    );
  }
}
