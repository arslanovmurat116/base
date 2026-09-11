import { NextResponse } from 'next/server';
import { getBoseSessionFromRequest } from './lib/security/session-server';
import { routePolicy, canAccessRoute, PROJECT_ONLY_ROLES } from './lib/security/access-policy';
export async function middleware(request) {
  const path = request.nextUrl.pathname;
  if(path === '/_next/image' && /^\/(project-files|demo-projects)\//.test(request.nextUrl.searchParams.get('url') || '')) return NextResponse.json({ok:false},{status:403});
  if (routePolicy(path,request.method) === 'public') return NextResponse.next();
  let session;
  try { session = await getBoseSessionFromRequest(request); }
  catch { return NextResponse.json({ok:false,message:'Проверка доступа временно недоступна.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
  const allowed = canAccessRoute(session,path,request.method);
  console.info(JSON.stringify({securityEvent:'request_access',path,method:request.method,allowed,actor:session?.telegramUserId||null,role:session?.role||null}));
  if (!allowed) {
    if (path.startsWith('/api/') || routePolicy(path,request.method) === 'deny') return NextResponse.json({ok:false,message:'Доступ запрещён.'},{status:session?403:401,headers:{'Cache-Control':'no-store'}});
    const url = request.nextUrl.clone(); url.pathname = session && PROJECT_ONLY_ROLES.includes(session.role) ? '/projects' : '/';url.search='';url.searchParams.set('auth',session?'forbidden':'required');
    return NextResponse.redirect(url);
  }
  // Fail closed on cross-origin cookie-authenticated mutations.
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ok:false},{status:403});
  }
  const response = NextResponse.next(); response.headers.set('Cache-Control','private, no-store'); return response;
}
export const config = {
  runtime: 'nodejs',
  matcher: ['/_next/image','/api/:path*','/projects/:path*','/project-files/:path*','/demo-projects/:path*','/dashboard/:path*','/workboard/:path*','/leads/:path*','/clients/:path*','/deals/:path*','/tasks/:path*','/appointments/:path*','/ai/:path*','/owner/:path*','/test/:path*','/debug/:path*','/scenario-drafts/:path*']
};
