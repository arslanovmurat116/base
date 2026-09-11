import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound,redirect } from 'next/navigation';
import { getBoseSessionFromCookieStore } from '../../../lib/security/session-server';
import { staffProjectPermissions } from '../../../lib/security/access-policy';
import { getProjectDetail } from '../../../lib/security/project-data';
export const dynamic='force-dynamic';
export default async function ProjectPage({params}) {
  const session=await getBoseSessionFromCookieStore(await cookies());
  const permissions=staffProjectPermissions(session?.role);if(!permissions.read)redirect('/?auth=required');
  const {id}=await params;const project=await getProjectDetail(id,session);if(!project)notFound();
  return <main className="page-shell"><Link href="/projects">Все проекты</Link><section className="page-heading"><h1>{project.title}</h1><p>{project.product}</p></section><section className="panel">{[['Стадия',project.stage],['Статус проекта',project.projectStatus],['Материалы',project.materials],['Фурнитура',project.hardware],['Цвет',project.color],['Адрес работ',project.address]].filter(([,v])=>v).map(([k,v])=><p key={k}><strong>{k}: </strong>{v}</p>)}</section><section className="panel"><h2>Материалы</h2>{project.files.map(file=><p key={file.id}><a href={file.url}>{file.name}</a> · v{file.version} · {file.current?'Актуальный':'Архив — не для производства'}</p>)}{!project.files.length&&<p>Доступных материалов пока нет.</p>}</section>{permissions.addFiles&&<a className="primary-link" href={'https://t.me/bose_business_os_bot?start=project_'+id}>Добавить фото и файлы в боте</a>}</main>;
}
