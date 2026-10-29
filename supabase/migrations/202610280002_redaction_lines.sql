begin;

alter table public.scripts add column redaction_lines text not null default 'all'
  check (redaction_lines in ('all', 'alternate'));
grant insert (redaction_lines), update (redaction_lines) on public.scripts to authenticated;

commit;
