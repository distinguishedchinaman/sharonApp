\set ON_ERROR_STOP on
-- Run only with platform-fixture.sql in a disposable database, after ALL migrations.
begin;

-- Prove this harness is not masking missing grants with legacy Supabase defaults.
create table public.__data_api_grant_probe (id bigint generated always as identity);
do $$
declare api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if has_table_privilege(api_role, 'public.__data_api_grant_probe', 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Test setup still automatically grants table access to %', api_role;
    end if;
    if has_sequence_privilege(api_role, pg_get_serial_sequence('public.__data_api_grant_probe', 'id'), 'USAGE,SELECT') then
      raise exception 'Test setup still automatically grants sequence access to %', api_role;
    end if;
  end loop;
end $$;

do $$
declare table_name text; function_name text;
begin
  foreach table_name in array array['households', 'household_members', 'games', 'players', 'household_invites'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass) then
      raise exception 'RLS is disabled on %', table_name;
    end if;
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'Anonymous table access on %', table_name;
    end if;
    if has_table_privilege('authenticated', 'public.' || table_name, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'Direct authenticated writes on %; journal writes must use RPCs', table_name;
    end if;
    if has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') <> (table_name <> 'household_invites') then
      raise exception 'Unexpected authenticated SELECT grant on %', table_name;
    end if;
  end loop;

  foreach function_name in array array[
    'public.join_household()',
    'public.get_journal(uuid)',
    'public.apply_journal_changes(uuid,jsonb,jsonb,bigint)',
    'public.is_household_member(uuid)',
    'public.can_access_game_photo(text)',
    'public.valid_journal_game(jsonb,uuid)',
    'public.valid_journal_player(jsonb)'
  ] loop
    if not has_function_privilege('authenticated', function_name, 'EXECUTE') then
      raise exception 'Missing authenticated EXECUTE on %', function_name;
    end if;
    if has_function_privilege('anon', function_name, 'EXECUTE') then
      raise exception 'Anonymous EXECUTE on %', function_name;
    end if;
  end loop;

  if not exists (
    select from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'households'
  ) then
    raise exception 'The household revision table is missing from Realtime';
  end if;
end $$;

-- Check actual reads using the client role, including the intentionally private invites.
set local role authenticated;
select id from public.households limit 0;
select user_id from public.household_members limit 0;
select id from public.games limit 0;
select id from public.players limit 0;
do $$ begin
  begin
    perform email from public.household_invites;
    raise exception 'Invitations are directly readable by authenticated users';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
\echo 'PASS: explicit table/function grants, private invitations, RLS and Realtime publication survive all migrations without automatic table grants.'
