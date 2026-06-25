import { NextResponse } from "next/server";
import { getCoreDealById } from "../../../../../lib/server-data";

export async function GET(_request, context) {
  try {
    const params = await Promise.resolve(context?.params);
    const deal = await getCoreDealById(params?.id);

    if (!deal) {
      return NextResponse.json(
        {
          ok: false,
          message: "Core deal not found"
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: deal
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Core deal API failed"
      },
      { status: 500 }
    );
  }
}
