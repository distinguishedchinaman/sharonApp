-- One household, private email membership, transactional edits, and a live revision signal.
begin;
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.household_invites (
  email text primary key check (email = lower(email) and length(email) between 3 and 254),
  household_id uuid not null references public.households(id) on delete cascade,
  player_id text not null check (player_id in ('ben', 'sharon')),
  unique (household_id, player_id)
);
create table if not exists public.household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  player_id text not null check (player_id in ('ben', 'sharon')),
  unique (household_id, player_id)
);
create or replace function public.is_household_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    join public.household_invites i on i.household_id = m.household_id and i.player_id = m.player_id
    where m.user_id = (select auth.uid()) and m.household_id = target
      and i.email = lower((select auth.jwt())->>'email')
  );
$$;
create or replace function public.valid_journal_game(d jsonb, household uuid) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if d is null or jsonb_typeof(d) <> 'object' or octet_length(d::text) > 32000 then return false; end if;
  if not (d ?& array['id','date','benScore','sharonScore','location','gameType','firstPlayer','notes','photoUrl','photoPath','isSample','createdAt','updatedAt']) then return false; end if;
  if jsonb_typeof(d->'id') <> 'string' or not ((d->>'id') ~ '^[A-Za-z0-9_-]{1,100}$') then return false; end if;
  if jsonb_typeof(d->'date') <> 'string' or not ((d->>'date') ~ '^\d{4}-\d{2}-\d{2}$') or not pg_catalog.pg_input_is_valid(d->>'date','date') then return false; end if;
  if (d->>'date')::date not between '1900-01-01'::date and '2200-12-31'::date then return false; end if;
  if jsonb_typeof(d->'benScore') <> 'number' or jsonb_typeof(d->'sharonScore') <> 'number' then return false; end if;
  if (d->>'benScore')::numeric not between 0 and 9999 or (d->>'benScore')::numeric <> trunc((d->>'benScore')::numeric) or (d->>'sharonScore')::numeric not between 0 and 9999 or (d->>'sharonScore')::numeric <> trunc((d->>'sharonScore')::numeric) then return false; end if;
  if jsonb_typeof(d->'location') <> 'string' or length(d->>'location') > 120 or jsonb_typeof(d->'notes') <> 'string' or length(d->>'notes') > 5000 then return false; end if;
  if jsonb_typeof(d->'gameType') <> 'string' or (d->>'gameType') not in ('Casual','Tournament','Club','Practice','Other') or jsonb_typeof(d->'firstPlayer') <> 'string' or (d->>'firstPlayer') not in ('','ben','sharon') then return false; end if;
  if jsonb_typeof(d->'isSample') <> 'boolean' or d->'photoUrl' <> 'null'::jsonb then return false; end if;
  if jsonb_typeof(d->'createdAt') <> 'string' or jsonb_typeof(d->'updatedAt') <> 'string' or not pg_catalog.pg_input_is_valid(d->>'createdAt','timestamptz') or not pg_catalog.pg_input_is_valid(d->>'updatedAt','timestamptz') then return false; end if;
  if d->'photoPath' <> 'null'::jsonb then
    if jsonb_typeof(d->'photoPath') <> 'string' or not ((d->>'photoPath') ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,100}/[0-9a-f-]{36}\.(jpg|png|webp)$') or split_part(d->>'photoPath','/',1) <> household::text or split_part(d->>'photoPath','/',2) <> d->>'id' then return false; end if;
  end if;
  return true;
exception when others then return false;
end;
$$;
create or replace function public.valid_journal_player(d jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare field text;
begin
  if d is null or jsonb_typeof(d) <> 'object' or not (d ?& array['id','name','crossTablesUrl','naspaRating','wgpoRating','ratingsLastUpdated','ratingSource']) or octet_length(d::text) > 2000 then return false; end if;
  if jsonb_typeof(d->'id') <> 'string' or (d->>'id') not in ('ben','sharon') or jsonb_typeof(d->'name') <> 'string' or length(trim(d->>'name')) not between 1 and 60 then return false; end if;
  if jsonb_typeof(d->'crossTablesUrl') <> 'string' or d->>'crossTablesUrl' <> (case when d->>'id' = 'ben' then 'https://www.cross-tables.com/results.php?playerid=15872' else 'https://www.cross-tables.com/results.php?p=22923' end) then return false; end if;
  foreach field in array array['naspaRating','wgpoRating'] loop
    if d->field <> 'null'::jsonb then
      if jsonb_typeof(d->field) <> 'number' or (d->>field)::numeric not between 0 and 4000 or (d->>field)::numeric <> trunc((d->>field)::numeric) then return false; end if;
    end if;
  end loop;
  if d->'ratingsLastUpdated' <> 'null'::jsonb and (jsonb_typeof(d->'ratingsLastUpdated') <> 'string' or not pg_catalog.pg_input_is_valid(d->>'ratingsLastUpdated','timestamptz')) then return false; end if;
  if d->'ratingSource' <> 'null'::jsonb and (d->>'ratingSource') not in ('manual','cross-tables') then return false; end if;
  return true;
exception when others then return false;
end;
$$;
create table if not exists public.games (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  data jsonb not null,
  primary key (household_id, id),
  check (data->>'id' = id and public.valid_journal_game(data, household_id))
);
create table if not exists public.players (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null check (id in ('ben','sharon')),
  data jsonb not null,
  primary key (household_id, id),
  check (data->>'id' = id and public.valid_journal_player(data))
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
revoke all on public.households, public.household_members, public.household_invites, public.games, public.players from public, anon, authenticated;
grant select on public.households, public.games, public.players to authenticated;
grant select on public.household_members to authenticated;
drop policy if exists "Members read their household" on public.households;
create policy "Members read their household" on public.households for select to authenticated using (public.is_household_member(id));
drop policy if exists "Members read their games" on public.games;
create policy "Members read their games" on public.games for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "Members read their players" on public.players;
create policy "Members read their players" on public.players for select to authenticated using (public.is_household_member(household_id));
drop policy if exists "Members read own membership" on public.household_members;
create policy "Members read own membership" on public.household_members for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.join_household() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare invitation public.household_invites%rowtype; existing public.household_members%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to open your journal.' using errcode = '42501'; end if;
  select * into invitation from public.household_invites where email = lower(auth.jwt()->>'email');
  if not found then raise exception 'This email is not invited to the shared journal.' using errcode = '42501'; end if;
  insert into public.household_members(user_id, household_id, player_id) values (auth.uid(), invitation.household_id, invitation.player_id) on conflict (user_id) do nothing;
  select * into existing from public.household_members where user_id = auth.uid();
  if existing.household_id <> invitation.household_id or existing.player_id <> invitation.player_id then raise exception 'Your invitation and membership do not match.' using errcode = '42501'; end if;
  return jsonb_build_object('householdId', existing.household_id, 'playerId', existing.player_id);
end;
$$;
create or replace function public.get_journal(target_household uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_household_member(target_household) then raise exception 'You do not have access to this journal.' using errcode = '42501'; end if;
  select jsonb_build_object('revision', h.revision,
    'games', coalesce((select jsonb_agg(g.data order by g.id) from public.games g where g.household_id = h.id), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(p.data order by p.id) from public.players p where p.household_id = h.id), '[]'::jsonb))
    into result from public.households h where h.id = target_household;
  return result;
end;
$$;
create or replace function public.apply_journal_changes(target_household uuid, game_changes jsonb, player_changes jsonb, expected_revision bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare change jsonb; current_data jsonb; item_id text; before_data jsonb; after_data jsonb; current_revision bigint;
begin
  if not public.is_household_member(target_household) then raise exception 'You do not have access to this journal.' using errcode = '42501'; end if;
  select revision into current_revision from public.households where id = target_household for update;
  if expected_revision is not null and expected_revision <> current_revision then raise exception 'The shared journal changed on another phone. Reload and review before replacing it.' using errcode = '40001'; end if;
  if jsonb_typeof(game_changes) <> 'array' or jsonb_typeof(player_changes) <> 'array' or jsonb_array_length(game_changes) > 50000 or jsonb_array_length(player_changes) > 2 then raise exception 'Invalid journal changes.' using errcode = '22023'; end if;
  for change in select value from jsonb_array_elements(game_changes) loop
    item_id := change->>'id'; before_data := coalesce(change->'before', 'null'::jsonb); after_data := coalesce(change->'after', 'null'::jsonb);
    if item_id is null or not (item_id ~ '^[A-Za-z0-9_-]{1,100}$') then raise exception 'Invalid game ID.' using errcode = '22023'; end if;
    select data into current_data from public.games where household_id = target_household and id = item_id;
    if coalesce(current_data, 'null'::jsonb) is distinct from before_data then raise exception 'This game changed on another phone. Your edit was not saved; review the latest game and try again.' using errcode = '40001'; end if;
    if after_data = 'null'::jsonb then delete from public.games where household_id = target_household and id = item_id;
    else
      if after_data->>'id' <> item_id or not public.valid_journal_game(after_data, target_household) then raise exception 'Invalid game data.' using errcode = '22023'; end if;
      insert into public.games(household_id, id, data) values (target_household, item_id, after_data) on conflict (household_id, id) do update set data = excluded.data;
    end if;
  end loop;
  for change in select value from jsonb_array_elements(player_changes) loop
    item_id := change->>'id'; before_data := coalesce(change->'before', 'null'::jsonb); after_data := coalesce(change->'after', 'null'::jsonb);
    select data into current_data from public.players where household_id = target_household and id = item_id;
    if coalesce(current_data, 'null'::jsonb) is distinct from before_data then raise exception 'Player ratings changed on another phone. Review the latest ratings and try again.' using errcode = '40001'; end if;
    if item_id is null or item_id not in ('ben','sharon') or after_data->>'id' <> item_id or not public.valid_journal_player(after_data) then raise exception 'Invalid player data.' using errcode = '22023'; end if;
    insert into public.players(household_id, id, data) values (target_household, item_id, after_data) on conflict (household_id, id) do update set data = excluded.data;
  end loop;
  if jsonb_array_length(game_changes) > 0 or jsonb_array_length(player_changes) > 0 then
    update public.households set revision = revision + 1, updated_at = clock_timestamp() where id = target_household;
  end if;
  return public.get_journal(target_household);
end;
$$;
revoke all on function public.is_household_member(uuid), public.join_household(), public.get_journal(uuid), public.apply_journal_changes(uuid,jsonb,jsonb,bigint) from public, anon;
grant execute on function public.is_household_member(uuid), public.join_household(), public.get_journal(uuid), public.apply_journal_changes(uuid,jsonb,jsonb,bigint) to authenticated;
revoke all on function public.valid_journal_game(jsonb,uuid), public.valid_journal_player(jsonb) from public, anon;
grant execute on function public.valid_journal_game(jsonb,uuid), public.valid_journal_player(jsonb) to authenticated;

insert into public.households(slug, name) values ('ben-sharon', 'Ben & Sharon') on conflict (slug) do nothing;
insert into public.players(household_id, id, data)
select h.id, p.id, p.data from public.households h cross join (values
  ('ben', '{"id":"ben","name":"Ben","crossTablesUrl":"https://www.cross-tables.com/results.php?playerid=15872","naspaRating":null,"wgpoRating":null,"ratingsLastUpdated":null,"ratingSource":null}'::jsonb),
  ('sharon', '{"id":"sharon","name":"Sharon","crossTablesUrl":"https://www.cross-tables.com/results.php?p=22923","naspaRating":null,"wgpoRating":null,"ratingsLastUpdated":null,"ratingSource":null}'::jsonb)
) as p(id,data) where h.slug = 'ben-sharon' on conflict (household_id, id) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('game-photos','game-photos',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create or replace function public.can_access_game_photo(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.households h where h.id::text = split_part(object_name,'/',1) and public.is_household_member(h.id));
$$;
revoke all on function public.can_access_game_photo(text) from public, anon;
grant execute on function public.can_access_game_photo(text) to authenticated;
drop policy if exists "Household reads photos" on storage.objects;
create policy "Household reads photos" on storage.objects for select to authenticated using (bucket_id = 'game-photos' and public.can_access_game_photo(name));
drop policy if exists "Household uploads photos" on storage.objects;
create policy "Household uploads photos" on storage.objects for insert to authenticated with check (bucket_id = 'game-photos' and public.can_access_game_photo(name));
drop policy if exists "Household deletes photos" on storage.objects;
create policy "Household deletes photos" on storage.objects for delete to authenticated using (bucket_id = 'game-photos' and public.can_access_game_photo(name));
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'households') then
    alter publication supabase_realtime add table public.households;
  end if;
end $$;
commit;
