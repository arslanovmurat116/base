import { NextResponse } from "next/server";
import { getCoreSummariesData } from "../../../../lib/server-data";

export async function GET() {
  try {
    const data = await getCoreSummariesData();

    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Core summaries API failed"
      },
      { status: 500 }
    );
  }
}
