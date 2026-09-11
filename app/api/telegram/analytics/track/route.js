import { NextResponse } from 'next/server';
import { getBoseSessionFromRequest } from '../../../../../lib/security/session-server';
import { trackTelegramAnalyticsEvent } from '../../../../../lib/telegram/analytics';
export async function POST(request) {
  const session=await getBoseSessionFromRequest(request);
  if(!session)return NextResponse.json({ok:false},{status:401});
  const body=await request.json();
  if(!['screen_view','button_click','link_click'].includes(body.eventName))return NextResponse.json({ok:false},{status:400});
  await trackTelegramAnalyticsEvent({companyId:session.companyId,sessionId:session.sessionId,profileId:session.profileId,subjectType:session.subjectType,subjectId:session.subjectId,telegramUserId:session.telegramUserId,eventName:body.eventName,eventPayload:{screen:String(body.eventPayload?.screen||'').slice(0,200)},timestamp:new Date().toISOString()});
  return NextResponse.json({ok:true});
}
