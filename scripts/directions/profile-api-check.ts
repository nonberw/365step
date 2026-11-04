import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const scratch=await mkdtemp(path.join(tmpdir(),'365-profile-'));
process.env.DB_FILE=path.join(scratch,'test.sqlite');process.env.TURSO_DATABASE_URL='';process.env.DATABASE_URL='';
const {app}=await import('../../server/app');const {db,ready}=await import('../../server/db');await ready;
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}/api`;
async function request(route:string,body?:unknown,token?:string,method?:string){const r=await fetch(base+route,{method:method??(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
try {
 const raw={firstName:'Проверка',lastName:'Профиля',email:'profile-check@example.test',password:'Profile1234',consent:true,grade:10,goals:{ent:{target:120,year:2028}}};
 for(const bad of [[],['it','business'],'missing']){const r=await request('/auth/register',{...raw,directionId:bad});assert.equal(r.status,400);}
 assert.equal((await db.execute("SELECT COUNT(*) n FROM users WHERE email='profile-check@example.test'")).rows[0]!.n,0);
 const registered=await request('/auth/register',{...raw,directionId:'business'});assert.equal(registered.status,201);const {token,user}=registered.data;
 assert.equal(user.learningProfile.directionId,'business');assert.equal(user.learningProfile.version,1);assert.equal(user.goals.ent.year,2028);
 const snapshot=await request('/auth/me',undefined,token);const before=snapshot.data;
 const race=await Promise.all(['design','medicine'].map(directionId=>request('/learning/profile',{directionId,expectedVersion:1},token,'PUT')));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 const current=(await request('/auth/me',undefined,token)).data;
 assert.equal(current.learningProfile.version,2);assert.deepEqual(current.goals,before.goals);assert.equal(current.xp,before.xp);assert.equal(current.planUntil,before.planUntil);
 const back=await request('/learning/profile',{directionId:'business',expectedVersion:2},token,'PUT');assert.equal(back.status,200);
 const events=await db.execute({sql:'SELECT COUNT(*) n FROM learning_profile_events WHERE user_id=?',args:[user.id]});assert.equal(events.rows[0]!.n,3);
 const boot=await request('/learning/bootstrap',undefined,token);assert.equal(boot.data.modules.length,5);const selected=boot.data.navigation.find((g:{title?:string})=>g.title==='Бизнес, менеджмент и предпринимательство');assert.equal(selected.items.length,5);assert.ok(selected.items.every((i:{to:string})=>i.to.startsWith('/learn/module/business-')));assert.ok(!boot.data.navigation.some((g:{title?:string})=>g.title==='Кодинг'||g.title==='Инженерия'));assert.deepEqual(boot.data.navigation.filter((g:{title?:string})=>g.title).slice(0,3).map((g:{title:string})=>g.title),['ЕНТ','SAT','IELTS']);assert.equal(boot.data.navigation.at(-1).items.at(-1).to,'/directions');
 assert.equal((await request('/learning/profile',{directionId:'it',expectedVersion:3},undefined,'PUT')).status,401);
 const optional=await request('/auth/register',{...raw,email:'exams-only@example.test',goals:{}});assert.equal(optional.status,201);assert.equal(optional.data.user.learningProfile.directionId,null);
 for(const path of ['/ent/meta','/sat/bank','/ielts/content','/coding/problems','/eng/progress','/path'])assert.equal((await request(path,undefined,optional.data.token)).status,200,path);
 console.log('Profile API: registration, atomic switching, conflict and history passed');
}finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
