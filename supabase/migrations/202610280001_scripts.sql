begin;

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled script' check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500000),
  redaction integer not null default 0 check (redaction between 0 and 500001),
  redaction_style text not null default 'full' check (redaction_style in ('full', 'half', 'first-letter')),
  scroll_speed integer not null default 30 check (scroll_speed between 10 and 120),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scripts_user_updated on public.scripts(user_id, updated_at desc, id);
alter table public.scripts enable row level security;

revoke all on public.scripts from anon, authenticated;
grant select, delete on public.scripts to authenticated;
grant insert (user_id, title, body, redaction, redaction_style, scroll_speed) on public.scripts to authenticated;
grant update (title, body, redaction, redaction_style, scroll_speed) on public.scripts to authenticated;

create policy scripts_select_own on public.scripts for select to authenticated
  using (user_id = (select auth.uid()));
create policy scripts_insert_own on public.scripts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy scripts_update_own on public.scripts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy scripts_delete_own on public.scripts for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.touch_script() returns trigger language plpgsql
  set search_path = '' as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger scripts_touch before update on public.scripts
  for each row execute function public.touch_script();

commit;
