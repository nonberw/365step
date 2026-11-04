import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const scratch=await mkdtemp(path.join(tmpdir(),'365-editor-'));process.env.DB_FILE=path.join(scratch,'test.sqlite');process.env.TURSO_DATABASE_URL='';process.env.DATABASE_URL='';
const {app}=await import('../../server/app');const {db,ready}=await import('../../server/db');await ready;
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
async function req(route:string,token?:string,body?:unknown,method?:string){const r=await fetch(base+route,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
try{
 const reg=async(email:string)=>{const r=await req('/auth/register',undefined,{firstName:'Тест',lastName:'Редактора',email,password:'Test12345!',consent:true,directionId:'business',grade:10,goals:{}});assert.equal(r.status,201);return r.data;};const student=await reg('student@test.invalid'),author=await reg('author@test.invalid'),reviewer=await reg('reviewer@test.invalid');
 // Fixture privileges exist only in this temporary database; no real accounts are modified.
 for(const u of [author,reviewer]){await db.execute({sql:"UPDATE users SET role='teacher' WHERE id=?",args:[u.user.id]});await db.execute({sql:'INSERT INTO school_admins(user_id,created_at) VALUES(?,?)',args:[u.user.id,Date.now()]});}
 const endpoint='/learning/editor/modules/business-01';assert.equal((await req(endpoint)).status,401);assert.equal((await req(endpoint,student.token)).status,403);
 const seed=await req(endpoint,author.token);assert.equal(seed.status,200);const content=seed.data.data;content.title='Стартап-гараж: редакционная версия';
 assert.equal((await req(endpoint,author.token,{data:{...content,lessons:[]},expectedVersion:0},'PUT')).status,400);
 assert.equal((await req(endpoint,author.token,{data:content,expectedVersion:0},'PUT')).status,200);assert.equal((await req(endpoint,author.token,{data:content,expectedVersion:0},'PUT')).status,409);
 assert.equal((await req(endpoint+'/publish',author.token,{version:1})).status,400);
 assert.equal((await req(endpoint+'/review',author.token,{version:1,scope:'subject',note:'Самопроверка автора не заменяет независимую оценку.'})).status,403);
 for(const scope of ['subject','language','rights'])assert.equal((await req(endpoint+'/review',reviewer.token,{version:1,scope,note:'Проверено на тестовой версии: структура и критерии согласованы; внешний контент не импортировался.'})).status,200);
 assert.equal((await req(endpoint+'/publish',author.token,{version:1})).status,200);assert.equal((await req('/learning/modules/business-01',student.token)).data.title,content.title);
 const project='/learning/projects/business-01-project',body=Array.from({length:130},(_,i)=>`слово${i}`).join(' ');await req(project+'/draft',student.token,{body,draftVersion:0,profileVersion:1},'PUT');assert.equal((await req(project+'/submit',student.token,{draftVersion:1})).status,200);
 assert.equal((await req('/learning/editor/submissions',student.token)).status,403);
 const grade=await req('/learning/editor/submissions/review',reviewer.token,{userId:student.user.id,projectId:'business-01-project',version:1,scores:[2,3,2,3,2],comment:'Постановка задачи ясна. Нужно дополнить основания вывода и ограничения выбранного метода.'});assert.equal(grade.status,200,JSON.stringify(grade.data));assert.deepEqual((await req(project,student.token)).data.review.scores,[2,3,2,3,2]);
 const diag=await req('/learning/diagnostic',student.token);assert.equal(diag.data.items.length,3);assert.ok(diag.data.items.every((q:object)=>!('answer' in q)));assert.equal((await req('/learning/diagnostic',student.token,{skipped:true,profileVersion:1})).status,200);assert.equal((await req('/learning/diagnostic',student.token)).data.result.skipped,true);
 console.log('Editorial API: permissions, draft conflicts, independent reviews, publication, project grading and optional diagnostics passed');
}finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
