import { getLeadsData, getLeadBySlug } from '../server-data';
import { listProjectFiles } from '../project-files';
import { projectDto, canReadProjectFile, isStaffRole } from './access-policy';
export async function getProjectList(session) {
  if (!isStaffRole(session?.role)) return [];
  return (await getLeadsData()).filter(lead=>lead.status!=='LOST').map(lead=>projectDto(lead,session.role));
}
export async function getProjectDetail(id, session) {
  if (!isStaffRole(session?.role)) return null;
  const lead=await getLeadBySlug(id); if(!lead)return null;
  const files=(await listProjectFiles(lead.slug)).filter(file=>canReadProjectFile(session.role,file));
  return {...projectDto(lead,session.role),files:files.map(file=>({id:file.id,name:file.fileName,version:file.version,current:file.isCurrent,url:'/api/blob?fileId='+encodeURIComponent(file.id)}))};
}
