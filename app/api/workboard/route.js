import { NextResponse } from "next/server";
import { getWorkboardData } from "../../../lib/server-data";
import { normalizeRole } from "../../../lib/roles";

export async function GET(request) {
  const role = normalizeRole(request.nextUrl.searchParams.get("role"));
  const data = await getWorkboardData(role);

  return NextResponse.json({
    ok: true,
    role,
    data
  });
}
