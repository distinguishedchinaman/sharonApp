import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CloudRepository } from '../src/lib/cloud-repository';
import { journalChanges, storedGame } from '../src/lib/journal-changes';
import { DEFAULT_PLAYERS, Game, Journal } from '../src/lib/model';
import { validateJournal } from '../src/lib/validation';
const household = '00000000-0000-0000-0000-000000000001';
const path = `${household}/a/00000000-0000-0000-0000-000000000002.jpg`;
const game: Game = { id:'a',date:'2026-10-01',benScore:400,sharonScore:300,gameType:'Casual',firstPlayer:'',location:'Kitchen',notes:'',photoUrl:null,isSample:false,createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z' };
const journal = (games: Game[]): Journal => ({version:1, games, players:structuredClone(DEFAULT_PLAYERS)});
test('private URL refresh produces no game edit; portable imports reject cloud references', () => {
 const before=journal([{...game,photoPath:path,photoUrl:'https://example.test/old'}]);
 const after=journal([{...game,photoPath:path,photoUrl:'https://example.test/new'}]);
 assert.deepEqual(journalChanges(before,after),{games:[],players:[]});
 assert.throws(()=>validateJournal(after),/portable/);
 assert.equal(validateJournal(after,true).games[0].photoPath,path);
 assert.deepEqual(journalChanges(journal([]),journal([game])).games[0].before,null);
});
test('cloud saves send individual deltas and propagate concurrency conflicts', async () => {
 let args: Record<string,unknown>={};
 const client={rpc:async(name:string,input:Record<string,unknown>)=>{if(name==='get_journal')return {data:{revision:4,games:[storedGame(game)],players:DEFAULT_PLAYERS},error:null};args=input;return {data:null,error:{code:'40001',message:'This game changed on another phone.'}};}} as unknown as SupabaseClient;
 const repo=new CloudRepository(client,household), before=await repo.load();
 await assert.rejects(repo.save(journal([{...game,notes:'edited'}]),before),/changed on another phone/);
 assert.equal((args.game_changes as unknown[]).length,1);
 assert.equal(args.expected_revision,null);
 await assert.rejects(repo.save(journal([]),before,{replaceAll:true}),/changed on another phone/);
 assert.equal(args.expected_revision,4);
});
test('a photo upload is persisted by path and signing failure after commit preserves the saved game', async()=>{
 let uploaded='', calls=0;
 const client={rpc:async(name:string,input:Record<string,unknown>)=>{
  if(name==='get_journal')return {data:{revision:0,games:[],players:DEFAULT_PLAYERS},error:null};
  calls++; const change=(input.game_changes as {after:Game}[])[0];
  assert.equal(change.after.photoUrl,null);assert.equal(change.after.photoPath,uploaded);
  return {data:{revision:1,games:[change.after],players:DEFAULT_PLAYERS},error:null};
 },storage:{from:()=>({upload:async(p:string)=>{uploaded=p;return {error:null};},createSignedUrls:async()=>({data:null,error:{message:'temporary failure'}})})}} as unknown as SupabaseClient;
 const repo=new CloudRepository(client,household),before=await repo.load();
 const saved=await repo.save(journal([{...game,photoUrl:'data:image/jpeg;base64,YQ=='}]),before);
 assert.match(uploaded,new RegExp(`^${household}/a/`));assert.equal(calls,1);assert.equal(repo.revision(saved),1);assert.equal(saved.games[0].photoUrl,'data:image/jpeg;base64,YQ==');
});
test('failed photo upload never posts a game mutation',async()=>{
 let posted=false;
 const client={rpc:async(name:string)=>{if(name==='get_journal')return {data:{revision:0,games:[],players:DEFAULT_PLAYERS},error:null};posted=true;return {};},storage:{from:()=>({upload:async()=>({error:{message:'offline'}})})}} as unknown as SupabaseClient;
 const repo=new CloudRepository(client,household),before=await repo.load();
 await assert.rejects(repo.save(journal([{...game,photoUrl:'data:image/jpeg;base64,YQ=='}]),before),/not been saved/);assert.equal(posted,false);
});
