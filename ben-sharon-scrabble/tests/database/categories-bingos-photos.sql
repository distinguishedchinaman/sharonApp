\set ON_ERROR_STOP on
begin;
do $$ declare h uuid; g jsonb; p jsonb; begin
 select id into h from public.households where slug='ben-sharon';
 g := jsonb_build_object('id','gallery','date','2026-10-01','benScore',400,'sharonScore',350,'location','Kitchen','gameType','Woogles - Correspondence','firstPlayer','ben','notes','','photoUrl',null,'photoPath',h||'/gallery/00000000-0000-0000-0000-000000000004.jpg','isSample',false,'createdAt','2026-10-01T12:00:00Z','updatedAt','2026-10-01T12:00:00Z','benBingos',jsonb_build_array('RETINAS','NASTIER'),'sharonBingos',jsonb_build_array('STAINER'),'additionalPhotos',jsonb_build_array(jsonb_build_object('id','sheet','photoUrl',null,'photoPath',h||'/gallery/00000000-0000-0000-0000-000000000005.png')));
 if not public.valid_journal_game(g,h) then raise exception 'Gallery game rejected'; end if;
 insert into public.games(household_id,id,data) values(h,'gallery',g);
 if public.valid_journal_game(jsonb_set(g,'{benBingos}','["<script>"]'),h) then raise exception 'Invalid bingo accepted'; end if;
 if public.valid_journal_game(jsonb_set(g,'{additionalPhotos,0,photoPath}','"00000000-0000-0000-0000-000000000099/gallery/00000000-0000-0000-0000-000000000005.png"'),h) then raise exception 'Cross-household photo accepted'; end if;
 if public.valid_journal_game(jsonb_set(g,'{additionalPhotos,0,photoUrl}','"https://example.test/public.jpg"'),h) then raise exception 'Public URL persisted'; end if;
 if public.valid_journal_game(jsonb_set(g,'{additionalPhotos,0,photoPath}','null'),h) then raise exception 'Missing private photo path accepted'; end if;
 p := g->'additionalPhotos'->0;
 if public.valid_journal_game(jsonb_set(g,'{additionalPhotos}',jsonb_build_array(p,p)),h) then raise exception 'Duplicate photo IDs accepted'; end if;
 if public.valid_journal_game(jsonb_set(g,'{additionalPhotos}',(select jsonb_agg(p||jsonb_build_object('id','p'||i)) from generate_series(1,12) i)),h) then raise exception 'Too many photos accepted'; end if;
 if public.valid_journal_game(jsonb_set(g,'{gameType}','"Invalid"'),h) then raise exception 'Invalid category accepted'; end if;
end $$;
rollback;
\echo 'PASS: category/bingo/gallery data accepted; invalid bingos, duplicate/oversized galleries, public URLs and cross-household paths rejected.'
