export const STAFF_ROLES = Object.freeze(['owner','manager','operator','designer','production','installer','workshop_head','production_manager']);
export const FULL_CRM_ROLES = ['owner','manager'];
export const PROJECT_ONLY_ROLES = STAFF_ROLES.filter(role => !FULL_CRM_ROLES.includes(role));
export const PROJECT_EDIT_ROLES = ['owner','manager','designer','production_manager'];
export const isStaffRole = role => STAFF_ROLES.includes(role);
export const isFullCrmRole = role => FULL_CRM_ROLES.includes(role);
export function routePolicy(path, method = 'GET') {
  if (path === '/api/telegram/webhook') return method === 'POST' ? 'public' : 'owner';
  if (['/api/telegram/miniapp/auth','/api/preferences/language'].includes(path)) return 'public';
  if (path.startsWith('/api/telegram/cron/')) return 'public'; // handler requires its own secret
  if (path === '/api/system/health') return 'public';
  if (['/api/telegram/miniapp/session','/api/telegram/miniapp/session/end','/api/telegram/analytics/track'].includes(path)) return 'session';
  if (['/owner','/test','/debug','/scenario-drafts','/api/admin','/api/telegram/dispatch','/api/scenario-drafts'].some(p => path === p || path.startsWith(p+'/'))) return 'owner';
  if (['/projects','/api/projects','/api/blob'].some(p => path === p || path.startsWith(p+'/'))) return 'project';
  if (['/project-files','/demo-projects'].some(p => path === p || path.startsWith(p+'/'))) return 'deny';
  if (path.startsWith('/api/') || ['/dashboard','/workboard','/leads','/clients','/deals','/tasks','/appointments','/ai'].some(p => path === p || path.startsWith(p+'/'))) return 'crm';
  return 'public';
}
export function canAccessRoute(session, path, method) {
  const policy = routePolicy(path, method);
  if (policy === 'public') return true;
  if (!session || policy === 'deny') return false;
  if (policy === 'session') return true;
  if (policy === 'owner') return session.role === 'owner';
  if (policy === 'project') return isStaffRole(session.role);
  return isFullCrmRole(session.role);
}
export function staffProjectPermissions(role) {
  const write = PROJECT_EDIT_ROLES.includes(role);
  return { read: isStaffRole(role), write, addPhoto: write || ['installer','workshop_head'].includes(role), addFiles: write || ['installer','workshop_head'].includes(role), role };
}
export function canReadProjectFile(role, file) {
  if (!isStaffRole(role) || !file) return false;
  if (isFullCrmRole(role)) return true;
  if (!file.isCurrent && !PROJECT_EDIT_ROLES.includes(role)) return false;
  if (/^estimate/.test(file.groupKey)) return false;
  if (file.kind === 'photo' || ['render','drawings','drawings-pdf'].includes(file.groupKey) || /^(photo|site-file)[:_-]/.test(file.groupKey)) return true;
  return ['designer','production_manager'].includes(role) && ['model','source-project'].includes(file.groupKey);
}
export function projectDto(lead, role) {
  const id = lead.slug || lead.id;
  const result = {
    id, title: 'Проект ' + String(id).slice(0,8), product: lead.product || '',
    stage: lead.order?.production?.stage || lead.productionStatus || '',
    projectStatus: lead.project?.status || '',
    materials: lead.project?.materials || '', hardware: lead.project?.hardware || '', color: lead.project?.color || ''
  };
  if (['installer','operator','designer','production_manager','owner','manager'].includes(role)) {
    result.address = lead.order?.installation?.address || lead.address || '';
  }
  return result;
}
