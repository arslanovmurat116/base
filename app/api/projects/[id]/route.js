import { NextResponse } from 'next/server';
import { getBoseSessionFromRequest } from '../../../../lib/security/session-server';
import { isStaffRole } from '../../../../lib/security/access-policy';
import { getProjectDetail } from '../../../../lib/security/project-data';
export async function GET(request,{params}) {
  const session=await getBoseSessionFromRequest(request);
  if(!isStaffRole(session?.role))return NextResponse.json({ok:false},{status:403});
  const {id}=await params;const data=await getProjectDetail(id,session);
  return NextResponse.json({ok:Boolean(data),data},{status:data?200:404,headers:{'Cache-Control':'private, no-store'}});
}
