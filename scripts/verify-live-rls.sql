-- Run as the database administrator. All fixtures are rolled back; no email,
-- password, identity, or login credential is created for these temporary IDs.
begin;
do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  script_id uuid;
  new_version integer;
  affected integer;
begin
  insert into auth.users(id) values (account_a), (account_b);
  perform set_config('request.jwt.claim.sub', account_a::text, true);
  execute 'set local role authenticated';

  insert into public.scripts(user_id, title, body)
    values (account_a, 'Disposable access verification', E'Line one\n\nLine two')
    returning id into script_id;
  assert (select count(*) from public.scripts where id = script_id) = 1,
    'The owner cannot read their script';

  perform set_config('request.jwt.claim.sub', account_b::text, true);
  assert (select count(*) from public.scripts where id = script_id) = 0,
    'A different account can read the script';
  update public.scripts set body = 'Unexpected write' where id = script_id;
  get diagnostics affected = row_count;
  assert affected = 0, 'A different account can edit the script';
  delete from public.scripts where id = script_id;
  get diagnostics affected = row_count;
  assert affected = 0, 'A different account can delete the script';

  perform set_config('request.jwt.claim.sub', account_a::text, true);
  update public.scripts set body = 'Updated by owner'
    where id = script_id and version = 1 returning version into new_version;
  assert new_version = 2, 'The revision trigger failed';
  update public.scripts set body = 'Stale update' where id = script_id and version = 1;
  get diagnostics affected = row_count;
  assert affected = 0, 'A stale revision overwrote a newer edit';
  execute 'reset role';
end;
$$;
rollback;
select 'PASS: ownership and revision checks; all test data rolled back' as result;
