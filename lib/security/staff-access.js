import { query, getPool, isLiveDatabaseEnabled } from '../db';
import { STAFF_ROLES } from './access-policy';
import { mapCoreRoleToTelegramRole } from '../core/roles';
const company = () => process.env.DISET_DEFAULT_COMPANY_ID || null;
export async function getAuthorizedStaff(telegramUserId, executor = query) {
  if (!company() || !isLiveDatabaseEnabled() || !/^[1-9]\d{0,19}$/.test(String(telegramUserId || ''))) return null;
  const result = await executor('select id, company_id, telegram_user_id, full_name, role, auth_version from users where company_id=$1 and telegram_user_id=$2 and is_active', [company(),String(telegramUserId)]);
  const row = result.rows[0];
  return row && STAFF_ROLES.includes(row.role) ? row : null;
}
export async function listAuthorizedSubscribers() {
  if (!company() || !isLiveDatabaseEnabled()) return [];
  const result = await query('select id,telegram_user_id,full_name,role from users where company_id=$1 and is_active and telegram_user_id is not null', [company()]);
  return result.rows.filter(row => STAFF_ROLES.includes(row.role)).map(row => ({chatId:row.telegram_user_id,telegramUserId:row.telegram_user_id,name:row.full_name,role:({owner:'director',operator:'measurer'}[row.role] || row.role),coreRole:row.role,source:'owner-assigned'}));
}
export async function assignStaffRole(actorTelegramId, input) {
  const targetId = String(input.telegramUserId || '');
  const role = String(input.role || '');
  if (!/^[1-9]\d{0,19}$/.test(targetId) || !STAFF_ROLES.includes(role) || role === 'owner') throw new Error('Можно назначить только рабочую роль по числовому Telegram ID. Владельцы задаются отдельно.');
  const name = String(input.name || '').trim().slice(0,120);
  if (!name) throw new Error('Укажите имя сотрудника.');
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const actor = await client.query("select id from users where company_id=$1 and telegram_user_id=$2 and role='owner' and is_active for update",[company(),String(actorTelegramId)]);
    if (!actor.rowCount) throw new Error('Роли назначает только владелец.');
    const target = await client.query('select id,role from users where company_id=$1 and telegram_user_id=$2 for update',[company(),targetId]);
    if (target.rows[0]?.role === 'owner') throw new Error('Нельзя менять владельца этой командой.');
    if (target.rowCount) {
      await client.query('update users set role=$3,full_name=$4,is_active=$5,auth_version=auth_version+1 where company_id=$1 and telegram_user_id=$2',[company(),targetId,role,name,input.active !== false]);
    } else {
      await client.query('insert into users(company_id,telegram_user_id,full_name,role,is_active,auth_version) values($1,$2,$3,$4,$5,1)',[company(),targetId,name,role,input.active !== false]);
    }
    await client.query("update miniapp_sessions set session_status='ENDED',ended_at=coalesce(ended_at,now()) where company_id=$1 and telegram_user_id=$2 and session_status='ACTIVE'",[company(),targetId]);
    await client.query("insert into security_audit_events(company_id,actor_telegram_id,event_name,target_telegram_id,details) values($1,$2,'staff_role_assigned',$3,$4::jsonb)",[company(),String(actorTelegramId),targetId,JSON.stringify({previousRole:target.rows[0]?.role||null,role,active:input.active !== false})]);
    await client.query('commit');
    return {ok:true};
  } catch(error) { await client.query('rollback'); throw error; } finally { client.release(); }
}
