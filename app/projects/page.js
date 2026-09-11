import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getBoseSessionFromCookieStore } from '../../lib/security/session-server';
import { isStaffRole } from '../../lib/security/access-policy';
import { getProjectList } from '../../lib/security/project-data';
export const dynamic='force-dynamic';
export default async function ProjectsPage() {
  const session=await getBoseSessionFromCookieStore(await cookies());
  if(!isStaffRole(session?.role))redirect('/?auth=required');
  const projects=await getProjectList(session);
  return <main className="page-shell"><section className="page-heading"><h1>Проекты</h1><p>Рабочие материалы и актуальные чертежи.</p></section><section className="lead-grid">{projects.map(project=><article className="lead-card" key={project.id}><h2>{project.title}</h2><p>{project.product}</p><p>{project.stage || project.projectStatus}</p><Link className="primary-link" href={'/projects/'+project.id}>Открыть проект</Link></article>)}</section>{!projects.length&&<p>Проектов пока нет.</p>}</main>;
}
