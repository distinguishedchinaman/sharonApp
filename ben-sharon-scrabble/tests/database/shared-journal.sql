\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into public.household_invites(email,household_id,player_id) select p.email,h.id,p.id from public.households h cross join (values ('ben@example.test','ben'),('sharon@example.test','sharon')) p(email,id) where h.slug='ben-sharon';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true),set_config('request.jwt.claims','{"email":"ben@example.test"}',true);
select public.join_household();
do $$ declare h uuid; g jsonb; edited jsonb; result jsonb; begin
 select id into h from public.households;
 g := '{"id":"test-a","date":"2026-10-01","benScore":400,"sharonScore":350,"location":"Kitchen","gameType":"Casual","firstPlayer":"","notes":"","photoUrl":null,"photoPath":null,"isSample":false,"createdAt":"2026-10-01T12:00:00Z","updatedAt":"2026-10-01T12:00:00Z"}';
 result := public.apply_journal_changes(h,jsonb_build_array(jsonb_build_object('id','test-a','before',null,'after',g)),'[]');
 if result->>'revision' <> '1' then raise exception 'Revision did not advance'; end if;
 edited := jsonb_set(g,'{notes}','"Ben edit"');
 perform public.apply_journal_changes(h,jsonb_build_array(jsonb_build_object('id','test-a','before',g,'after',edited)),'[]');
 begin
 perform public.apply_journal_changes(h,jsonb_build_array(jsonb_build_object('id','test-a','before',g,'after',jsonb_set(g,'{notes}','"Sharon edit"'))),'[]');
 raise exception 'Stale edit accepted';
 exception when serialization_failure then null; end;
 -- A different addition based on the old journal must preserve Ben's edit.
 result := public.apply_journal_changes(h,jsonb_build_array(jsonb_build_object('id','test-b','before',null,'after',jsonb_set(g,'{id}','"test-b"'))),'[]');
 if jsonb_array_length(result->'games') <> 2 or not exists(select from jsonb_array_elements(result->'games') x where x->>'notes'='Ben edit') then raise exception 'Independent additions lost data'; end if;
 begin
 perform public.apply_journal_changes(h,'[]','[]',1);
 raise exception 'Stale replace accepted';
 exception when serialization_failure then null; end;
 begin
 perform public.apply_journal_changes(h,jsonb_build_array(jsonb_build_object('id','bad','before',null,'after',jsonb_set(jsonb_set(g,'{id}','"bad"'),'{benScore}','-1'))),'[]');
 raise exception 'Invalid scores accepted';
 exception when invalid_parameter_value then null; end;
 begin
 insert into public.games(household_id,id,data) values(h,'bypass',g);
 raise exception 'Direct insert bypass accepted';
 exception when insufficient_privilege then null; end;
 insert into storage.objects(bucket_id,name) values('game-photos',h||'/test-a/00000000-0000-0000-0000-000000000004.jpg');
 if (select count(*) from storage.objects) <> 1 then raise exception 'Member cannot read own photo'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true),set_config('request.jwt.claims','{"email":"sharon@example.test"}',true);
select public.join_household();
do $$ declare h uuid; begin
 select id into h from public.households;
 if jsonb_array_length(public.get_journal(h)->'games') <> 2 then raise exception 'Sharon cannot read shared games'; end if;
 if (select count(*) from storage.objects) <> 1 then raise exception 'Sharon cannot read shared photo'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true),set_config('request.jwt.claims','{"email":"outsider@example.test"}',true);
do $$ begin
 begin perform public.join_household(); raise exception 'Outsider joined'; exception when insufficient_privilege then null; end;
 if exists(select from public.games) or exists(select from public.households) or exists(select from storage.objects) then raise exception 'Outsider read private data'; end if;
 begin perform public.get_journal('00000000-0000-0000-0000-000000000099'); raise exception 'Outsider called journal RPC'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values('game-photos','00000000-0000-0000-0000-000000000099/test-a/x.jpg'); raise exception 'Outsider uploaded'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform public.join_household(); raise exception 'Anonymous RPC accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo 'PASS: invited accounts share records/photos; stale edits/replaces conflict; unrelated adds survive; invalid writes, direct writes, outsiders and anonymous users are denied.'
