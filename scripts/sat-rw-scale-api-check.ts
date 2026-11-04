/** Run against a disposable database; never the student's localhost data. */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SAT_RW_SCALE } from "../shared/satRwScale";
import { SAT_BY_ID } from "../shared/sat";
import { normaliseText } from "../shared/satQuality";
import manifest from "../shared/satRwScaleManifest.json";
const scratch=await mkdtemp(path.join(tmpdir(),"365-rw-scale-"));
process.env.DB_FILE=path.join(scratch,"test.sqlite");process.env.TURSO_DATABASE_URL="";process.env.DATABASE_URL="";
process.env.ANTHROPIC_API_KEY="";process.env.TELEGRAM_BOT_TOKEN="";
const {app}=await import("../server/app");const {db,ready}=await import("../server/db");await ready;
const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
const base=`http://127.0.0.1:${(server.address()as{port:number}).port}/api`;
let token="",checks=0;
function ok(v:unknown,message:string){assert.ok(v,message);checks++;}
async function request(route:string,body?:unknown,expected=200){
 const response=await fetch(base+route,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json() as any;assert.equal(response.status,expected,`${route}: ${JSON.stringify(data)}`);checks++;return data;
}
try{
 await request("/sat/bank?collection=rw-scale",undefined,401);
 const account=await request("/auth/register",{firstName:"English",lastName:"QA",email:"english-scale@example.test",password:"EnglishScale2026",consent:true,goals:{}},201);token=account.token;
 ok(account.user.learningProfile.directionId===null,"exam bank requires no direction");
 ok((await request("/sat/bank?section=rw")).total===4200,"English parity count");
 ok((await request("/sat/bank?section=math")).total===4157,"Math unchanged");
 ok((await request("/sat/bank?collection=rw-open")).total===360,"previous collection retained");
 const ids:string[]=[];
 for(let page=0;page<Math.ceil(manifest.total/40);page++){
  const bank=await request(`/sat/bank?collection=rw-scale&section=rw&page=${page}`);
  ok(bank.total===3191&&bank.items.length===Math.min(40,3191-page*40),"complete collection pagination");
  ok(bank.items.every((q:any)=>q.id.startsWith("rw-scale-")&&!("answer"in q)&&!("explanation"in q)),"correct scope and private keys");
  ids.push(...bank.items.map((q:any)=>q.id));
 }
 ok(ids.length===3191&&new Set(ids).size===3191,"each addition appears exactly once");
 const native=await request("/sat/bank?collection=rw-scale-native");ok(native.total===711&&native.items.every((q:any)=>q.purpose==="assessment"),"native reading filter");
 const practice=await request("/sat/bank?collection=rw-scale-practice");ok(practice.total===2480&&practice.items.every((q:any)=>q.purpose==="reinforcement"),"practice explicitly separated");
 ok((await request("/sat/bank?collection=rw-scale&purpose=assessment")).total===711,"purpose combines with collection");
 ok((await request("/sat/bank?collection=rw-scale&difficulty=3")).total===0,"no inflated Hard labels");
 ok((await request("/sat/bank?collection=rw-scale&section=math")).total===0,"new collection contains only English");
 for(const [domain,count]of Object.entries(manifest.domains))ok((await request(`/sat/bank?collection=rw-scale&domain=${encodeURIComponent(domain)}`)).total===count,`${domain}: filter`);
 // Every native key, plus a representative of each controlled language family.
 const sample=SAT_RW_SCALE.filter(q=>q.id.startsWith("rw-scale-bb-"));
 const families=new Set<string>();
 for(const q of SAT_RW_SCALE.filter(q=>q.purpose==="reinforcement"))if(!families.has(q.familyId!)){families.add(q.familyId!);sample.push(q);}
 for(const q of sample){
  const shown=(await request(`/sat/question/${q.id}`)).question;
  ok(shown.attribution.sourceUrl&&shown.attribution.download==="/content/sat-rw-scale-2026.json"&&!("answer"in shown)&&!("explanation"in shown)&&!("answerText"in shown),`${q.id}: attribution without key`);
  const wrong=await request("/sat/answer",{id:q.id,response:(Number(q.answer)+1)%4,ms:1000});ok(!wrong.correct,`${q.id}: distractor rejected`);
  const right=await request("/sat/answer",{id:q.id,response:q.answer,ms:1000});ok(right.correct&&right.explanation===q.explanation,`${q.id}: correct key and explanation`);
 }
 const saved=sample[0]!;await request("/sat/save",{id:saved.id,saved:true});
 ok((await request("/sat/bank?collection=rw-scale&status=saved")).items[0].id===saved.id,"saving a new source question");
 let exam=await request("/sat/test/start",{mode:"full"});const english:string[]=[];
 for(let module=0;module<4;module++){
  ok(exam.questions.every((q:any)=>q.purpose==="assessment"),"full exam excludes reinforcement");
  if(module<2){ok(exam.questions.length===27,"full English module size");english.push(...exam.questions.map((q:any)=>normaliseText(q.passage)));}
  const answers=Object.fromEntries(exam.questions.map((q:any)=>[q.id,SAT_BY_ID.get(q.id)!.answer]));
  exam=await request(`/sat/test/${exam.test.id}/submit`,{answers,seconds:1});
 }
 ok(new Set(english).size===54&&!!exam.test.finishedAt,"complete exam, no repeated English passage");
 const hard=await request("/sat/drill",{kind:"hard-rw"});
 ok(hard.items.length===10&&hard.items.every((q:any)=>q.difficulty===3),"existing Hard drill remains available");
 console.log(`${checks} English scale API assertions passed; ${sample.length} native/family keys checked on disposable data`);
}finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
