-- Adds furniture execution roles without changing legacy lead or Telegram flows.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('owner', 'manager', 'operator', 'designer', 'production', 'installer'));

alter table telegram_subscribers drop constraint if exists telegram_subscribers_role_check;
alter table telegram_subscribers add constraint telegram_subscribers_role_check
  check (role in ('director', 'manager', 'measurer', 'designer', 'production', 'installer'));

insert into roles (company_id, code, name, description, scope, is_system)
select c.id, r.code, r.name, r.description, r.scope, true
from companies c
cross join (
  values
    ('designer', 'Designer', 'Can update project details and current materials.', 'company'),
    ('production', 'Production', 'Can view current project materials for manufacturing.', 'company'),
    ('installer', 'Installer', 'Can view current project materials for installation.', 'company')
) as r(code, name, description, scope)
on conflict (company_id, code) do update
set name = excluded.name,
    description = excluded.description,
    scope = excluded.scope,
    is_system = excluded.is_system,
    updated_at = now();

insert into user_roles (company_id, user_id, role_id)
select u.company_id, u.id, r.id
from users u
join roles r on r.company_id = u.company_id and r.code = u.role
where u.role in ('designer', 'production', 'installer')
on conflict (user_id, role_id) do nothing;
