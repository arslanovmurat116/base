import { NextResponse } from 'next/server';
import { getBoseSessionFromRequest } from '../../../../../../lib/security/session-server';
import { getBoseSessionCookieName } from '../../../../../../lib/security/session-auth';
import { endMiniAppSession } from '../../../../../../lib/telegram/analytics';
export async function POST(request) {
  const session=await getBoseSessionFromRequest(request);
  if(!session)return NextResponse.json({ok:false},{status:401});
  await endMiniAppSession({companyId:session.companyId,sessionId:session.sessionId});
  const response=NextResponse.json({ok:true});
  response.cookies.set({name:getBoseSessionCookieName(),value:'',path:'/',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax'});
  return response;
}
