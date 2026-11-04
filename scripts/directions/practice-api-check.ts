import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const scratch=await mkdtemp(path.join(tmpdir(),'365-practice-'));process.env.DB_FILE=path.join(scratch,'test.sqlite');process.env.TURSO_DATABASE_URL='';process.env.DATABASE_URL='';
const {app}=await import('../../server/app');const {db,ready}=await import('../../server/db');await ready;
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
async function req(route:string,token?:string,body?:unknown,method?:string){const r=await fetch(base+route,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
try{
 const reg=async(email:string)=>{const r=await req('/auth/register',undefined,{firstName:'Тест',lastName:'Практики',email,password:'Test12345!',consent:true,directionId:'business',grade:10,goals:{}});assert.equal(r.status,201);return r.data;};
 const a=await reg('practice@test.invalid'),b=await reg('other@test.invalid');
 assert.equal((await req('/learning/modules/medicine-01',a.token)).status,403);for(const route of ['/coding/problems','/eng/progress','/sat/bank','/ent/meta','/ielts/content'])assert.equal((await req(route,a.token)).status,200,route);
 const boot=await req('/learning/bootstrap',a.token);assert.equal(boot.data.modules.length,5);
 const lesson=await req('/learning/lessons/business-01-lesson-2',a.token);assert.equal(lesson.status,200);assert.ok(lesson.data.items.every((q:object)=>!('answer' in q)&&!('explanation' in q)));
 const starts=await Promise.all([0,1].map(()=>req('/learning/attempts',a.token,{lessonId:lesson.data.id,profileVersion:1,idempotencyKey:'practice-race-key'})));assert.deepEqual(starts.map(r=>r.status).sort(),[200,201]);assert.equal(starts[0]!.data.attemptId,starts[1]!.data.attemptId);const id=starts[0]!.data.attemptId;
 assert.equal((await req(`/learning/attempts/${id}`,b.token)).status,404);
 assert.equal((await req(`/learning/attempts/${id}/finish`,a.token,{})).status,400);
 const text=Array.from({length:30},(_,i)=>`слово${i}`).join(' ');
 for(const q of lesson.data.items){const r=await req(`/learning/attempts/${id}/answers`,a.token,{itemId:q.id,answer:q.kind==='numeric'?'15':text});assert.equal(r.status,200);assert.equal(r.data.correct,q.kind==='numeric'?true:null);}
 const finished=await Promise.all([0,1].map(()=>req(`/learning/attempts/${id}/finish`,a.token,{})));assert.ok(finished.every(r=>r.status===200));assert.equal((await req('/auth/me',a.token)).data.xp,12);
 const project='/learning/projects/business-01-project';assert.equal((await req(project+'/draft',a.token,{body:text,draftVersion:0,profileVersion:1},'PUT')).status,200);assert.equal((await req(project+'/draft',a.token,{body:'stale',draftVersion:0,profileVersion:1},'PUT')).status,409);
 await req('/learning/profile',a.token,{directionId:'medicine',expectedVersion:1},'PUT');assert.equal((await req(project,a.token)).data.archived,true);assert.equal((await req(project,b.token)).data.draft.body,'');assert.equal((await req('/learning/modules/business-01',a.token)).status,403);assert.ok(!(await req('/learning/search',a.token)).data.some((x:{id:string})=>x.id.startsWith('business')));
 await req('/learning/profile',a.token,{directionId:'business',expectedVersion:2},'PUT');assert.equal((await req(project,a.token)).data.draft.body,text);assert.equal((await req('/learning/bootstrap',a.token)).data.completed.length,1);assert.equal((await req('/auth/me',a.token)).data.xp,12);
 assert.equal((await req('/path/nuet',a.token)).status,200);
 console.log('Practice API: focus, answer privacy, concurrent idempotency, ownership, XP once, draft conflicts and profile restoration passed');
}finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
