import { NextResponse } from "next/server";
import { updatePilotRequestStatus } from "../../../../lib/server-data";

export async function POST(request) {
  const body = await request.json();
  const result = await updatePilotRequestStatus(body);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400
  });
}
