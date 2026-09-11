import { NextResponse } from 'next/server';
import { getBoseSessionFromRequest } from '../../../../../lib/security/session-server';
export async function GET(request) {
  const session=await getBoseSessionFromRequest(request);
  return NextResponse.json({ok:Boolean(session),session},{status:session?200:401,headers:{'Cache-Control':'no-store'}});
}
