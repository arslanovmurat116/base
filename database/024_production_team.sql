-- Additive role migration. Does not remove staff, projects or files.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check
  (role in ('owner','manager','operator','designer','production','installer','workshop_head','production_manager'));
alter table telegram_subscribers drop constraint if exists telegram_subscribers_role_check;
alter table telegram_subscribers add constraint telegram_subscribers_role_check check
  (role in ('director','manager','measurer','designer','production','installer','workshop_head','production_manager'));

alter table users add column if not exists telegram_user_id text;
create unique index if not exists users_company_telegram_identity
  on users (company_id, telegram_user_id) where telegram_user_id is not null;

insert into roles (company_id, code, name, description, scope, is_system)
select c.id, r.code, r.name, r.description, 'company', true from companies c
cross join (values
  ('workshop_head', 'Workshop head', 'Read projects and add production photos.'),
  ('production_manager', 'Production manager', 'Manage project details and materials, without owner access.')
) r(code, name, description)
on conflict (company_id, code) do update set name=excluded.name, description=excluded.description;
