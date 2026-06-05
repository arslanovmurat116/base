import { NextResponse } from "next/server";
import { captureManagerOutcome } from "../../../../../lib/server-data";

export async function POST(request, context) {
  const params = await Promise.resolve(context?.params);
  const slug = params?.slug;
  const body = await request.json();
  const result = await captureManagerOutcome(slug, body);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400
  });
}
