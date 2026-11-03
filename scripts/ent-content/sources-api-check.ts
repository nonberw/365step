import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createClient} from '@libsql/client';
import {ENT_SOURCE_BANK,ENT_SOURCE_META} from '../../server/content/ent/source-bank';
const file=join(mkdtempSync(join(tmpdir(),'365step-ent-sources-')),'qa.sqlite'),port=41000+process.pid%10000,base=`http://127.0.0.1:${port}/api`;
const env={...process.env,DB_FILE:file,API_PORT:String(port),ANTHROPIC_API_KEY:'',TURSO_DATABASE_URL:'',DATABASE_URL:'',TELEGRAM_BOT_TOKEN:''};
let log='',token='',checks=0;
function start(){const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);return child;}
let child=start();const db=createClient({url:`file:${file}`});
const ok=(test:unknown,message:string)=>{assert.ok(test,message);checks++;};
async function ready(){for(let i=0;i<120;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error(log);}
async function req(path:string,body?:unknown,status=200){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json()as any;assert.equal(r.status,status,JSON.stringify(data));checks++;return data;}
try{
 await ready();ok((await req('/health')).ai==='demo','provider disabled');
 const account=await req('/auth/register',{email:'ent-source-qa@example.test',password:'SourcesQuality2026',firstName:'Source',lastName:'QA',consent:true,grade:10,goals:{ent:{year:2028}}},201);token=account.token;
 const meta=await req('/ent/sources/meta');ok(meta.total===ENT_SOURCE_BANK.length&&meta.conditions===ENT_SOURCE_META.conditions,'honest counts');
 ok((await req('/ent/meta')).sourceBank.total===meta.total,'home discovery');
 const combinations=[...new Set(ENT_SOURCE_BANK.map(q=>[q.sourceId,q.subject,q.lang,q.kind].join(':')))];
 for(const combo of combinations){
  const [source,subject,lang,kind]=combo.split(':');const filters={source,subject,lang,kind};
  const bank=await req('/ent/sources/bank?'+new URLSearchParams(filters as Record<string,string>));const pool=ENT_SOURCE_BANK.filter(q=>q.sourceId===source&&q.subject===subject&&q.lang===lang&&q.kind===kind);
  ok(bank.total===pool.length,'counts obey all filters');ok(bank.items.length>0&&bank.items.length<=30,'pagination');
  const practice=await req('/ent/sources/practice',filters);ok(practice.items.length===Math.min(10,pool.length),'practice size');
  ok(new Set(practice.items.map((q:any)=>q.conditionId)).size===practice.items.length,'no repeated condition across translations');
  for(const q of practice.items){ok(q.sourceId===source&&q.subject===subject&&q.lang===lang&&q.kind===kind,'no relaxed filters');for(const field of ['answer','accepted','explanation','evidence','evidenceUrl'])ok(!(field in q),'private answer field '+field);}
  const q=pool[0]!,shown=(await req('/ent/sources/question/'+q.id)).question;
  for(const field of ['answer','accepted','explanation','evidence','evidenceUrl'])ok(!(field in shown),'single-question key privacy');
  const key=q.kind==='choice'?q.answer:q.accepted![0];const solved=await req('/ent/sources/check',{id:q.id,answer:key});ok(solved.correct,'published key accepted');
  const wrong=await req('/ent/sources/check',{id:q.id,answer:q.kind==='choice'?(q.answer!+1)%4:'intentionally-wrong-qa'});ok(!wrong.correct,'wrong response rejected');
 }
 const invalid=await req('/ent/sources/practice',{subject:'kazakh',lang:'ru'});ok(!invalid.items.length&&invalid.message,'no foreign-language fallback');
 const hard=await req('/ent/sources/practice',{level:'C'});ok(hard.items.length>0&&hard.items.every((q:any)=>q.level==='C'&&q.review==='independent-math-verified'),'difficulty filter never guesses labels');
 const math=ENT_SOURCE_BANK.find(q=>q.responseRule==='numeric')!;ok((await req('/ent/sources/check',{id:math.id,answer:math.accepted![0]})).correct,'exact fractions accepted');
 const multi=ENT_SOURCE_BANK.find(q=>q.responseRule==='number-set'&&q.accepted![0]!.includes(','))!;const reversed=multi.accepted![0]!.split(',').reverse().join(',');ok((await req('/ent/sources/check',{id:multi.id,answer:reversed})).correct,'number sets accept reordering');
 const evidence=ENT_SOURCE_BANK.find(q=>q.sourceId==='kazqad')!;const checked=await req('/ent/sources/check',{id:evidence.id,answer:evidence.accepted![0]});ok(checked.correct&&checked.evidence&&checked.evidenceUrl,'evidence revealed only after check');
 const wrong=await req('/ent/sources/bank?status=wrong');ok(wrong.total>0&&wrong.items.every((q:any)=>q.status==='wrong'),'persistent mistake review filter');
 const q=ENT_SOURCE_BANK[0]!;await req('/ent/sources/check',{id:q.id,answer:q.kind==='choice'?q.answer:q.accepted![0]});
 const solved=await req('/ent/sources/bank?status=new');ok(solved.total<meta.total,'solved questions excluded from unseen');
 await req('/ent/sources/question/nonexistent',undefined,404);
 const before=await db.execute('SELECT COUNT(*) n FROM ent_source_attempts');
 await new Promise<void>(r=>{child.once('exit',()=>r());child.kill('SIGTERM');});child=start();await ready();
 const after=await db.execute('SELECT COUNT(*) n FROM ent_source_attempts');ok(after.rows[0]!.n===before.rows[0]!.n,'progress survives restart');
 ok((await req('/ent/sources/bank?status=wrong')).total===wrong.total||Number(after.rows[0]!.n)>0,'source bank survives existing database');
 // Existing simulation still assembles its original 120/140 format.
 await req('/ent/profile',{pair:'math-physics',lang:'ru'});const test=await req('/ent/test/start',{kind:'full'});const paper=await req('/ent/test/'+test.id);ok(paper.blocks.flatMap((b:any)=>b.items).length===120,'full ENT format retained');
 console.log(`${checks} source-bank API assertions passed across ${combinations.length} source/subject/language/format combinations on disposable data`);
}finally{db.close();child.kill('SIGTERM');}
