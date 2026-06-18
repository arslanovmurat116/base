import { NextResponse } from "next/server";
import { updateProductLaunchStatus } from "../../../../lib/server-data";

export async function POST(request) {
  const body = await request.json();
  const result = await updateProductLaunchStatus(body);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400
  });
}
