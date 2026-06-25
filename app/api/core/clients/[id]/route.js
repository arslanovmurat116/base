import { NextResponse } from "next/server";
import { getCoreClientById } from "../../../../../lib/server-data";

export async function GET(_request, context) {
  try {
    const params = await Promise.resolve(context?.params);
    const client = await getCoreClientById(params?.id);

    if (!client) {
      return NextResponse.json(
        {
          ok: false,
          message: "Core client not found"
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: client
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "Core client API failed"
      },
      { status: 500 }
    );
  }
}
