import { NextResponse } from "next/server";
import { completeFollowup } from "../../../../lib/server-data";

export async function POST(request) {
  const body = await request.json();
  const result = await completeFollowup(body);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400
  });
}
