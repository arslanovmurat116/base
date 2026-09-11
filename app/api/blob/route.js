import { NextResponse } from 'next/server';
import { getPrivateBlob, isBlobStoreEnabled } from '../../../lib/persistent-store';
import { getProjectFile } from '../../../lib/project-files';
import { query } from '../../../lib/db';
import { getTelegramBotToken } from '../../../lib/telegram';
import { getBoseSessionFromRequest } from '../../../lib/security/session-server';
import { canReadProjectFile } from '../../../lib/security/access-policy';
export async function GET(request) {
  const session=await getBoseSessionFromRequest(request);
  if(!session)return NextResponse.json({ok:false},{status:401});
  const id=request.nextUrl.searchParams.get('fileId');
  const pathname=request.nextUrl.searchParams.get('pathname');
  let file=null;
  if(id && /^[0-9a-f-]{36}$/i.test(id))file=await getProjectFile(id);
  else if(pathname?.startsWith('project-files/')) {
    const result=await query('select id from project_file_versions where company_id=$1 and storage_path=$2 order by created_at desc limit 1',[session.companyId,pathname]);
    if(result.rows[0])file=await getProjectFile(result.rows[0].id);
  }
  if(!canReadProjectFile(session.role,file))return NextResponse.json({ok:false},{status:403});
  let stream;
  if(file.telegramFileId) {
    const token=getTelegramBotToken();
    const meta=await fetch('https://api.telegram.org/bot'+token+'/getFile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file_id:file.telegramFileId}),cache:'no-store'}).then(r=>r.json());
    const remote=meta.result?.file_path;
    if(!meta.ok||!remote||remote.includes('..')||!/^[-a-zA-Z0-9_./]+$/.test(remote))return NextResponse.json({ok:false},{status:404});
    const response=await fetch('https://api.telegram.org/file/bot'+token+'/'+remote,{cache:'no-store'});
    if(!response.ok)return NextResponse.json({ok:false},{status:404});
    stream=response.body;
  } else if(file.pathname?.startsWith('project-files/') && isBlobStoreEnabled()) {
    const result=await getPrivateBlob(file.pathname);if(result?.statusCode===200)stream=result.stream;
  }
  if(!stream)return NextResponse.json({ok:false},{status:404});
  return new NextResponse(stream,{headers:{'Cache-Control':'private, no-store','Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`}});
}
