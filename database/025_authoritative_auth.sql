-- No inferred staff grants. Explicit numeric identities are provisioned separately.
alter table users add column if not exists telegram_user_id text;
alter table users add column if not exists auth_version integer not null default 1;
create unique index if not exists users_company_telegram_identity on users(company_id,telegram_user_id) where telegram_user_id is not null;
alter table miniapp_sessions add column if not exists security_version integer not null default 1;
alter table miniapp_sessions add column if not exists auth_version integer;
create table if not exists security_audit_events (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id),
  actor_telegram_id text, event_name text not null, target_telegram_id text,
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists security_audit_events_company_time on security_audit_events(company_id,created_at desc);
-- All v1 cookies are rejected by the v2 verifier, even if their DB row was removed.
update miniapp_sessions set session_status='ENDED',ended_at=coalesce(ended_at,now()) where security_version < 2 and session_status='ACTIVE';

create or replace function bump_staff_auth_version() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active or new.telegram_user_id is distinct from old.telegram_user_id then
    new.auth_version := old.auth_version + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists users_auth_version_change on users;
create trigger users_auth_version_change before update on users for each row execute function bump_staff_auth_version();
