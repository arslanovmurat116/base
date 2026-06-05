import { NextResponse } from "next/server";
import { createFollowup } from "../../../../lib/server-data";

export async function POST(request) {
  const body = await request.json();
  const result = await createFollowup(body);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400
  });
}
