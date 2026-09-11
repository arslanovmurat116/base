import { query, isLiveDatabaseEnabled } from '../db';
import { verifyBoseSessionToken, getBoseSessionCookieName } from './session-auth';
import { isStaffRole } from './access-policy';
export async function resolveServerSession(token, executor = query) {
  const claims = await verifyBoseSessionToken(token);
  if (!claims || !isLiveDatabaseEnabled() || claims.companyId !== process.env.DISET_DEFAULT_COMPANY_ID) return null;
  const result = await executor(`
    select s.id,s.company_id,s.subject_type,s.subject_id,s.telegram_user_id,s.expires_at,s.profile_id,
      s.session_status,s.security_version,s.auth_version as session_auth_version,
      u.id as user_id,u.role,u.is_active,u.auth_version as user_auth_version
    from miniapp_sessions s
    left join users u on u.company_id=s.company_id and u.telegram_user_id=s.telegram_user_id
    where s.id=$1 and s.company_id=$2 and s.telegram_user_id=$3
  `,[claims.sessionId,claims.companyId,claims.telegramUserId]);
  const row = result.rows[0];
  if (!row || row.session_status !== 'ACTIVE' || row.security_version !== 2 || new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.user_id && (!row.is_active || !isStaffRole(row.role) || row.session_auth_version !== row.user_auth_version)) return null;
  if (row.subject_type === 'user' && (!row.user_id || row.subject_id !== row.user_id)) return null;
  return {sessionId:row.id,companyId:row.company_id,telegramUserId:row.telegram_user_id,subjectType:row.subject_type,subjectId:row.subject_id,profileId:row.profile_id,role:row.user_id ? row.role : 'client',isOwner:row.user_id ? row.role === 'owner' : false,expiresAt:row.expires_at};
}
export function getBoseSessionFromRequest(request) { return resolveServerSession(request?.cookies?.get?.(getBoseSessionCookieName())?.value); }
export function getBoseSessionFromCookieStore(cookies) { return resolveServerSession(cookies?.get?.(getBoseSessionCookieName())?.value); }
