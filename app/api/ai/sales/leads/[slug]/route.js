import { NextResponse } from "next/server";
import { getLeadAISalesAssistantData } from "../../../../../../lib/server-data";

export async function GET(_request, context) {
  try {
    const params = await Promise.resolve(context?.params);
    const result = await getLeadAISalesAssistantData(params?.slug);

    return NextResponse.json(result, {
      status: result.ok ? 200 : 404
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error.message || "AI sales assistant API failed"
      },
      { status: 500 }
    );
  }
}
