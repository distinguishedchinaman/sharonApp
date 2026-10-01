-- Apply after the original shared-journal migration. Preserves game IDs, scores, photos and history.
begin;
create or replace function public.valid_journal_game(d jsonb, household uuid) returns boolean
language plpgsql immutable set search_path = '' as $$
declare field text; item jsonb;
begin
  if d is null or jsonb_typeof(d) <> 'object' or octet_length(d::text) > 32000 then return false; end if;
  if not (d ?& array['id','date','benScore','sharonScore','location','gameType','firstPlayer','notes','photoUrl','photoPath','isSample','createdAt','updatedAt']) then return false; end if;
  if jsonb_typeof(d->'id') <> 'string' or not ((d->>'id') ~ '^[A-Za-z0-9_-]{1,100}$') then return false; end if;
  if jsonb_typeof(d->'date') <> 'string' or not ((d->>'date') ~ '^\d{4}-\d{2}-\d{2}$') or not pg_catalog.pg_input_is_valid(d->>'date','date') then return false; end if;
  if (d->>'date')::date not between '1900-01-01'::date and '2200-12-31'::date then return false; end if;
  if jsonb_typeof(d->'benScore') <> 'number' or jsonb_typeof(d->'sharonScore') <> 'number' then return false; end if;
  if (d->>'benScore')::numeric not between 0 and 9999 or (d->>'benScore')::numeric <> trunc((d->>'benScore')::numeric) or (d->>'sharonScore')::numeric not between 0 and 9999 or (d->>'sharonScore')::numeric <> trunc((d->>'sharonScore')::numeric) then return false; end if;
  if jsonb_typeof(d->'location') <> 'string' or length(d->>'location') > 120 or jsonb_typeof(d->'notes') <> 'string' or length(d->>'notes') > 5000 then return false; end if;
  if jsonb_typeof(d->'gameType') <> 'string' or (d->>'gameType') not in ('Casual','Tournament','Club','Practice','Other','In Person - Morning','In Person - Afternoon','In Person - Evening','Woogles - League','Woogles - Correspondence') or jsonb_typeof(d->'firstPlayer') <> 'string' or (d->>'firstPlayer') not in ('','ben','sharon') then return false; end if;
  if jsonb_typeof(d->'isSample') <> 'boolean' or d->'photoUrl' <> 'null'::jsonb then return false; end if;
  if jsonb_typeof(d->'createdAt') <> 'string' or jsonb_typeof(d->'updatedAt') <> 'string' or not pg_catalog.pg_input_is_valid(d->>'createdAt','timestamptz') or not pg_catalog.pg_input_is_valid(d->>'updatedAt','timestamptz') then return false; end if;
  if d->'photoPath' <> 'null'::jsonb then
    if jsonb_typeof(d->'photoPath') <> 'string' or not ((d->>'photoPath') ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,100}/[0-9a-f-]{36}\.(jpg|png|webp)$') or split_part(d->>'photoPath','/',1) <> household::text or split_part(d->>'photoPath','/',2) <> d->>'id' then return false; end if;
  end if;
  foreach field in array array['benBingos','sharonBingos'] loop
    if d ? field then
      if jsonb_typeof(d->field) <> 'array' or jsonb_array_length(d->field) > 50 then return false; end if;
      for item in select value from jsonb_array_elements(d->field) loop
        if jsonb_typeof(item) <> 'string' or not ((item #>> '{}') ~ '^[A-Za-z?]{2,30}$') then return false; end if;
      end loop;
    end if;
  end loop;
  if d ? 'additionalPhotos' then
    if jsonb_typeof(d->'additionalPhotos') <> 'array' or jsonb_array_length(d->'additionalPhotos') > 11 then return false; end if;
    if (select count(distinct p->>'id') from jsonb_array_elements(d->'additionalPhotos') p) <> jsonb_array_length(d->'additionalPhotos') then return false; end if;
    for item in select value from jsonb_array_elements(d->'additionalPhotos') loop
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'id') is distinct from 'string' or not ((item->>'id') ~ '^[A-Za-z0-9_-]{1,100}$') or item->>'id' = 'primary' or item->'photoUrl' is distinct from 'null'::jsonb or jsonb_typeof(item->'photoPath') is distinct from 'string' then return false; end if;
      if not public.valid_journal_game((d - 'additionalPhotos' - 'benBingos' - 'sharonBingos') || jsonb_build_object('photoPath',item->'photoPath'), household) then return false; end if;
    end loop;
  end if;
  return true;
exception when others then return false;
end;
$$;
-- Convert only legacy types, as requested. Re-running does not recategorize new games.
with updated as (
  update public.games set data = jsonb_set(data,'{gameType}','"In Person - Evening"'::jsonb)
  where data->>'gameType' in ('Casual','Tournament','Club','Practice','Other')
  returning household_id
)
update public.households set revision = revision + 1, updated_at = clock_timestamp()
where id in (select household_id from updated);
commit;
