import { NextResponse } from "next/server";
import { updateCustomerSuccessStatus } from "../../../../lib/server-data";

export async function POST(request) {
  const body = await request.json();
  const result = await updateCustomerSuccessStatus(body);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400
  });
}
