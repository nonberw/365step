/** All writes go to a new temporary SQLite file. Provider credentials are disabled. */
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";
import {createClient} from "@libsql/client";
import {ENT_OPEN,ENT_OPEN_BY_ID} from "../../server/content/ent";
import {ENT_SUBJECTS,ENT_PAIRS,ENT_SUBJECT,entPoints} from "../../shared/ent";
import {choiceKey} from "../../shared/numeric";
const folder=mkdtempSync(join(tmpdir(),'365step-ent-')),file=join(folder,'qa.sqlite');
const port=31000+process.pid%10000,base=`http://127.0.0.1:${port}/api`;
const env={...process.env,DB_FILE:file,API_PORT:String(port),ANTHROPIC_API_KEY:'',TURSO_DATABASE_URL:'',DATABASE_URL:'',TELEGRAM_BOT_TOKEN:''};
let logs='',token='',checks=0;
function start(){const processChild=spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:['ignore','pipe','pipe']});processChild.stdout.on('data',d=>logs+=d);processChild.stderr.on('data',d=>logs+=d);return processChild;}
let child=start();const db=createClient({url:`file:${file}`});
function ok(value:unknown,message:string){assert.ok(value,message);checks++;}
async function request(path:string,body?:unknown,expected=200){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json() as any;assert.equal(r.status,expected,`${path}: ${JSON.stringify(data)}`);checks++;return data;}
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(logs);}
try{
 await ready();ok((await request('/health')).ai==='demo','no paid provider');
 const account=await request('/auth/register',{email:'ent-qa@example.test',password:'EntQuality2026',firstName:'ENT',lastName:'QA',grade:10,consent:true,goals:{ent:{year:2028,date:'2028-05-10'}}},201);token=account.token;
 const uid=account.user.id;
 const count=await db.execute("SELECT count(*) n FROM ent_questions WHERE id LIKE 'eo-%'");ok(Number(count.rows[0]!.n)===ENT_OPEN.length,'all shipped rows inserted');
 for(const lang of ['ru','kk']){
  await request('/ent/profile',{pair:ENT_PAIRS[0]!.id,lang,target:130});
  const meta=await request('/ent/meta');ok(meta.subjects.length===16&&meta.subjects.every((s:any)=>s.coverage.total>0),'all subjects discoverable');
  for(const subject of ENT_SUBJECTS){
   const actualLang=subject.fixedLang??lang;
   for(const part of subject.plan){
    const practice=await request('/ent/practice',{subject:subject.id,type:part.type});
    ok(practice.items.length>0,`${subject.id}/${lang}/${part.type}: practice available`);
    for(const q of practice.items){ok(q.subject===subject.id&&q.lang===actualLang&&q.type===part.type,'correct filters');ok(!('answer'in q)&&!('explanation'in q)&&!('expected'in q)&&!('parameters'in q),'private answer fields');ok(q.attribution.url&&q.attribution.licenseUrl,'source shown');}
    const q=practice.items[0],privateQ=ENT_OPEN_BY_ID.get(q.id)!;
    ok((await request('/ent/check',{id:q.id,answer:privateQ.answer,ms:10})).points===entPoints(q.type),'key accepted by API');
   }
   for(const topic of subject.topics){const p=await request('/ent/practice',{subject:subject.id,topic});ok(p.items.length>0&&p.items.every((q:any)=>q.topic===topic&&q.subject===subject.id),'topic coverage and isolation');}
   const hard=await request('/ent/practice',{subject:subject.id,difficulty:'C'});
   ok(hard.items.every((q:any)=>q.difficulty==='C'),'difficulty never relaxed');
   const hasHard=ENT_OPEN.some(q=>q.subject===subject.id&&q.lang===actualLang&&q.type===subject.plan[0]!.type&&q.difficulty==='C');ok(hasHard?hard.items.length>0:hard.unavailable,'honest empty hard filters');
  }
  for(const pair of ENT_PAIRS){
   await request('/ent/profile',{pair:pair.id,lang});
   const started=await request('/ent/test/start',{kind:'full'}),test=await request(`/ent/test/${started.id}`);
   const all=test.blocks.flatMap((b:any)=>b.items);
   ok(all.length===120&&new Set(all.map((q:any)=>q.id)).size===120,'full 120-item test, no repeated ID');
   ok(all.reduce((n:number,q:any)=>n+entPoints(q.type),0)===140,'140 points');
   for(const block of test.blocks){const spec=ENT_SUBJECT[block.subject]!;for(const part of spec.plan)ok(block.items.filter((q:any)=>q.type===part.type).length===part.count,'exact type allocation');
    const contexts=block.items.filter((q:any)=>q.type==='context');for(const gid of new Set(contexts.map((q:any)=>q.groupId)))ok(contexts.filter((q:any)=>q.groupId===gid).length===5,'complete five-question context');
   }
   ok(all.every((q:any)=>!('answer'in q)),'test does not expose keys');
   const reopen=await request(`/ent/test/${started.id}`);ok(JSON.stringify(reopen.blocks)===JSON.stringify(test.blocks),'reopening keeps the option order');
   if(pair.id===ENT_PAIRS[0]!.id){
    const answers=Object.fromEntries(all.map((q:any)=>[q.id,ENT_OPEN_BY_ID.get(q.id)!.answer]));
    const result=await request(`/ent/test/${started.id}/submit`,{answers});ok(result.total===140&&result.max===140,'perfect full test scores 140');
    const again=await request(`/ent/test/${started.id}/submit`,{answers});ok(again.total===140,'repeat submit remains complete');
   }
  }
 }
 await request('/ent/profile',{pair:ENT_PAIRS[0]!.id,lang:'ru'});
 // Every item has been seen: ordinary practice must keep working as review.
 const pool=ENT_OPEN.filter(q=>q.subject==='math'&&q.lang==='ru'&&q.type==='single');
 await db.batch(pool.map(q=>({sql:"INSERT INTO attempts (user_id,module,item_id,skill,correct,ms,at) VALUES (?,'ent',?,?,1,0,?)",args:[uid,q.id,`math:${q.topic}`,Date.now()]})),'write');
 const repeated=await request('/ent/practice',{subject:'math',type:'single'});ok(repeated.items.length===10&&repeated.review,'exhaustion offers repeat practice');
 const next=await request('/ent/master/next',{subject:'math'});ok(!('accept'in next.item)&&next.item.id.startsWith('t:eo-'),'typed mode uses shipped material without exposing key');
 const typed=ENT_OPEN_BY_ID.get(next.item.id.slice(2))!;
 const solved=await request('/ent/master/answer',{subject:'math',id:next.item.id,answer:choiceKey(typed.options[typed.answer as number]!)});ok(solved.correct,'plain fraction accepted for displayed LaTeX numeric answer');
 // Restart tests the seed marker and history retention; it must not insert duplicates.
 const before=await db.execute("SELECT count(*) n FROM attempts");
 await new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.kill('SIGTERM');});child=start();await ready();
 const after=await db.execute("SELECT count(*) n FROM ent_questions WHERE id LIKE 'eo-%'");ok(Number(after.rows[0]!.n)===ENT_OPEN.length,'seed is idempotent');
 const attempts=await db.execute("SELECT count(*) n FROM attempts");ok(attempts.rows[0]!.n===before.rows[0]!.n,'attempt history survives restart');
 console.log(`${checks} ENT API assertions passed: all 16 subjects, both UI languages, ${ENT_PAIRS.length*2} full mock combinations; disposable database only`);
}finally{db.close();child.kill('SIGTERM');}
