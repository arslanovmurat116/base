import { NextResponse } from 'next/server';
import { getBoseSessionFromRequest } from '../../../lib/security/session-server';
import { isStaffRole } from '../../../lib/security/access-policy';
import { getProjectList } from '../../../lib/security/project-data';
export async function GET(request) {
  const session=await getBoseSessionFromRequest(request);
  if(!isStaffRole(session?.role))return NextResponse.json({ok:false},{status:403});
  return NextResponse.json({ok:true,data:await getProjectList(session)},{headers:{'Cache-Control':'private, no-store'}});
}
