import { NextResponse } from "next/server";
import { getAppointmentsData } from "../../../lib/server-data";

export async function GET() {
  const data = await getAppointmentsData();

  return NextResponse.json({
    ok: true,
    data
  });
}
