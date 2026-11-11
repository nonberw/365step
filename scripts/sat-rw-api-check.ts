/** Disposable DB only: never reads or writes the student's preview account. */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SAT_RW_EXPANSION } from "../shared/satRw";
import { SAT_BY_ID, SAT_ACTIVE_BANK } from "../shared/sat";
import { normaliseText } from "../shared/satQuality";
const scratch=await mkdtemp(path.join(tmpdir(),"365-sat-rw-"));
process.env.DB_FILE=path.join(scratch,"test.sqlite");
process.env.TURSO_DATABASE_URL="";process.env.DATABASE_URL="";
process.env.ANTHROPIC_API_KEY="";process.env.TELEGRAM_BOT_TOKEN="";
const {app}=await import("../server/app");const {db,ready}=await import("../server/db");await ready;
const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
let token="",checks=0;
function ok(v:unknown,message:string){assert.ok(v,message);checks++;}
async function request(route:string,body?:unknown,expected=200){
 const response=await fetch(base+route,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json() as any;assert.equal(response.status,expected,`${route}: ${JSON.stringify(data)}`);checks++;return data;
}
try {
 await request("/sat/bank?collection=rw-open",undefined,401);
 const account=await request("/auth/register",{firstName:"SAT",lastName:"Проверка",email:"rw-check@example.test",password:"SatRWCheck2026",consent:true,goals:{}},201);token=account.token;
 ok(account.user.learningProfile.directionId===null,"English available without choosing direction");
 const all=await request("/sat/bank?section=rw");ok(all.total===SAT_ACTIVE_BANK.filter(q=>q.section==="rw").length,"all English count visible");
 const active=SAT_ACTIVE_BANK.filter(q=>q.id.startsWith("rw-open-"));
 const ids:string[]=[];
 for(let page=0;page<Math.ceil(active.length/40);page++){
  const bank=await request(`/sat/bank?section=rw&collection=rw-open&page=${page}`);
  ok(bank.total===active.length&&bank.items.length===Math.min(40,active.length-page*40),"all collection pages filled");
  ok(bank.items.every((q:any)=>q.id.startsWith("rw-open-")&&!("answer" in q)&&!("explanation" in q)),"summaries scoped and keys private");
  ids.push(...bank.items.map((q:any)=>q.id));
 }
 ok(new Set(ids).size===active.length,"pagination covers every new question exactly once");
 const hard=await request("/sat/bank?collection=rw-open&difficulty=3");ok(hard.total===active.filter(q=>q.difficulty===3).length,"combined Hard filter");
 ok((await request("/sat/bank?collection=rw-open&section=math")).total===0,"collection cannot leak Math");
 for(const domain of new Set(SAT_RW_EXPANSION.map(q=>q.domain))){
  const filtered=await request(`/sat/bank?collection=rw-open&domain=${encodeURIComponent(domain)}`);
  ok(filtered.total===active.filter(q=>q.domain===domain).length,"domain counts and filtering");
 }
 for(const skill of new Set(SAT_RW_EXPANSION.map(q=>q.skill))){
  const filtered=await request(`/sat/bank?collection=rw-open&skills=${encodeURIComponent(skill)}`);
  ok(filtered.total===active.filter(q=>q.skill===skill).length,`${skill}: skill filter`);
 }
 // Exercise the public fetch and checker for every published key, not a sample.
 for(const q of SAT_RW_EXPANSION){
  const shown=(await request(`/sat/question/${q.id}`)).question;
  ok(shown.choices.length===4&&shown.attribution.sourceId===q.attribution!.sourceId&&!("answer" in shown)&&!("explanation" in shown),`${q.id}: source visible, key absent before submit`);
  const wrong=await request("/sat/answer",{id:q.id,response:(Number(q.answer)+1)%4,ms:1000});
  ok(!wrong.correct&&wrong.explanation.includes("— неверно:"),`${q.id}: distractor rejected with rationale`);
  const right=await request("/sat/answer",{id:q.id,response:q.answer,ms:1000});
  ok(right.correct&&right.answer===q.answer&&right.explanation===q.explanation,`${q.id}: key and complete explanation returned`);
 }
 const q=active[0]!;
 await request("/sat/save",{id:q.id,saved:true});
 ok((await request("/sat/bank?collection=rw-open&status=saved")).items[0].id===q.id,"new question can be saved");
 const restored=(await request(`/sat/question/${q.id}`));ok(restored.saved,"save state survives question reload");
 let test=await request("/sat/test/start",{mode:"full"});const passages:string[]=[];
 for(let module=0;module<4;module++){
  if(module<2){ok(test.questions.length===27,"full English module length");passages.push(...test.questions.map((q:any)=>normaliseText(q.passage)));}
  const answers=Object.fromEntries(test.questions.map((q:any)=>[q.id,SAT_BY_ID.get(q.id)!.answer]));
  test=await request(`/sat/test/${test.test.id}/submit`,{answers,seconds:1});
 }
 ok(new Set(passages).size===54,"no repeated passage across full exam's English modules");
 ok(!!test.test.finishedAt,"full exam still completes");
 const drill=await request("/sat/drill",{kind:"hard-rw"});
 ok(drill.items.length===10&&drill.items.every((q:any)=>q.difficulty===3),"Hard English drill remains full and Hard");
 ok(new Set(drill.items.map((q:any)=>normaliseText(q.passage))).size===10,"no repeated passage in Hard drill");
 console.log(`${checks} SAT RW API assertions passed on disposable database`);
}finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
