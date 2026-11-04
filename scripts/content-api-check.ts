/** Integration checks always start an isolated local server. Never points at a user's live database. */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@libsql/client";
import { SAT_BY_ID, SAT_ACTIVE_BANK } from "../shared/sat";
import { fingerprint, familyOf } from "../shared/satQuality";
import { IELTS_ACADEMIC } from "../server/content/ieltsAcademic";
import { READING } from "../server/content/ielts";

const folder=mkdtempSync(join(tmpdir(),"365step-api-")),file=join(folder,"test.sqlite");
const port=21000+process.pid%10000,base=`http://127.0.0.1:${port}/api`;
const child=spawn(process.execPath,["--import","tsx","server/index.ts"],{env:{...process.env,DB_FILE:file,API_PORT:String(port),ANTHROPIC_API_KEY:"",TURSO_DATABASE_URL:"",DATABASE_URL:"",TELEGRAM_BOT_TOKEN:""},stdio:["ignore","pipe","pipe"]});
let logs="", token="",checks=0;
child.stdout.on("data",chunk=>logs+=chunk);child.stderr.on("data",chunk=>logs+=chunk);
const db=createClient({url:`file:${file}`});
function ok(value:unknown,message:string){assert.ok(value,message);checks++;}
async function request(path:string,body?:unknown,expected=200){
 const r=await fetch(base+path,{method:body===undefined?"GET":"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json() as any;assert.equal(r.status,expected,`${path}: ${JSON.stringify(data)}`);checks++;return data;
}
try {
 let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(base+"/health");if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert.ok(ready,logs);
 ok((await request("/health")).ai==="demo","API credentials disabled");
 const account=await request("/auth/register",{email:"content-qa@example.test",password:"Quality2026test",firstName:"Content",lastName:"QA",consent:true,directionId:"it",goals:{sat:{target:1450,date:"2027-03-13"},ielts:{target:7,date:"2027-08-15"},ent:{target:120,year:2028}}},201);token=account.token;
 const bank=await request("/sat/bank");ok(bank.total===SAT_ACTIVE_BANK.length,"canonical bank count");
 const newCollection=await request("/sat/bank?collection=open");ok(newCollection.total===120&&newCollection.items.every((q:any)=>q.id.startsWith("open-")),"new collection is directly discoverable");
 ok((await request("/sat/bank?collection=open&difficulty=3")).total===50,"new collection Hard filter");
 ok((await request("/sat/bank?collection=open&section=math")).total===80,"new collection Math filter");
 ok((await request("/sat/bank?collection=open&section=rw")).total===40,"new collection RW filter");
 const scaleItems=SAT_ACTIVE_BANK.filter(q=>q.id.startsWith("scale-"));
 const scale=await request("/sat/bank?collection=scale");ok(scale.total===scaleItems.length&&scale.total>=3000,"large collection directly discoverable");
 ok((await request("/sat/bank?collection=scale&difficulty=3")).total===scaleItems.filter(q=>q.difficulty===3).length,"large Hard count");
 ok((await request("/sat/bank?collection=scale-practice")).total===2400,"procedural collection counted separately");
 ok((await request("/sat/bank?collection=scale-source")).total===scaleItems.length-2400,"source and authored items counted separately");
 ok((await request("/sat/bank?collection=scale&purpose=reinforcement")).total===2400,"purpose filter separates variants");
 for(const prefix of ["scale-source-","scale-practice-","scale-deepmind-","scale-rw-"]){
   const q=scaleItems.find(q=>q.id.startsWith(prefix))!;
   const shown=(await request(`/sat/question/${q.id}`)).question;
   ok(shown.attribution.license&&!("answer" in shown)&&!("explanation" in shown)&&!("expected" in shown),`${prefix}: license visible, reference key private`);
   ok((await request("/sat/answer",{id:q.id,response:q.answer})).correct,`${prefix}: key accepted through API`);
 }
 const bus=await request("/sat/question/m-ratio-04");ok(!("answer" in bus.question)&&!("acceptedAnswers" in bus.question),"answer aliases not leaked");
 ok((await request("/sat/answer",{id:"m-ratio-04",response:"100/3"})).correct,"fraction through API");
 ok(!(await request("/sat/answer",{id:"m-ratio-04",response:"33.33"})).correct,"unrequested rounding rejected through API");
 await request("/sat/question/m-trig-02");
 const legacyQ=SAT_BY_ID.get("m-trig-02")!;
 await request("/sat/save",{id:legacyQ.id,saved:true});
 // Saved alias is available even when suppressed from fresh bank listing.
 const saved=await request("/sat/bank?status=saved");ok(saved.items.some((q:any)=>q.id===legacyQ.id),"saved legacy duplicate remains accessible");
 let test=await request("/sat/test/start",{mode:"full"});const used:string[]=[];
 const reopened=await request(`/sat/test/${test.test.id}`);ok(JSON.stringify(reopened.questions)===JSON.stringify(test.questions),"reopen preserves option order");
 for(let m=0;m<4;m++){
  const questions=test.questions as any[];ok(questions.length===(m<2?27:22),"full module size");
  used.push(...questions.map(q=>q.id));
  const answers=Object.fromEntries(questions.map(q=>[q.id,SAT_BY_ID.get(q.id)!.answer]));
  test=await request(`/sat/test/${test.test.id}/submit`,{answers,seconds:1});
 }
 ok(!!test.test.finishedAt&&test.review.length===4,"full SAT completes");
 const selected=used.map(id=>SAT_BY_ID.get(id)!);ok(new Set(selected.map(fingerprint)).size===98,"no repeat conditions in full SAT");
 ok(selected.every(q=>q.purpose==="assessment"),"expanded procedural practice excluded from full test");
 const familyCounts=new Map<string,number>();for(const q of selected)familyCounts.set(familyOf(q),(familyCounts.get(familyOf(q))??0)+1);ok([...familyCounts.values()].every(n=>n<=2),"family cap throughout SAT");
 const hardMath=await request("/sat/drill",{kind:"hard-math"});ok(hardMath.items.length===10&&hardMath.items.every((q:any)=>q.difficulty===3)&&!hardMath.note.includes("Доступно"),"Hard math drill fills all ten slots without lowering difficulty");
 const hardRw=await request("/sat/drill",{kind:"hard-rw"});ok(hardRw.items.length===10&&hardRw.items.every((q:any)=>q.difficulty===3)&&!hardRw.note.includes("Доступно"),"Hard RW drill fills all ten slots without lowering difficulty");
 const openMath=await request("/sat/question/open-math-singular-systems");
 ok(openMath.question.attribution.sourceId==="precalc"&&!("answer" in openMath.question)&&!("explanation" in openMath.question),"open Math attribution visible, answer remains private before checking");
 ok((await request("/sat/answer",{id:openMath.question.id,response:"26"})).correct,"new parameter problem checked through API");
 const openRw=await request("/sat/question/open-rw-theory-before-data");
 ok(openRw.question.attribution.sourceId==="holmes"&&openRw.question.choices.length===4&&!("answer" in openRw.question),"open RW available without key leakage");
 ok((await request("/sat/answer",{id:openRw.question.id,response:SAT_BY_ID.get(openRw.question.id)!.answer})).correct,"new RW checked through API");
 const path=await request("/path/sat-math");const first=path.units.flatMap((u:any)=>u.nodes).find((n:any)=>n.status==="current"&&n.kind==="lesson");
 const lesson=await request(`/path/sat-math/${first.id}/start`,{});const firstItem=lesson.items[0];
 await request("/path/answer",{lessonId:lesson.lessonId,itemId:firstItem.id,response:null},400);
 const ans=await request("/path/answer",{lessonId:lesson.lessonId,itemId:firstItem.id,response:SAT_BY_ID.get(firstItem.id)!.answer});ok(ans.correct,"lesson uses shared checker");
 const content=await request("/ielts/content");ok(content.readingStats.uniquePassages===20&&content.readingStats.sets===65,"honest IELTS counts");
 const exercise=READING.find(r=>r.questions.length===5)!;
 const short=await request(`/ielts/reading/${exercise.id}`,{answers:Object.fromEntries(exercise.questions.map(q=>[q.id,q.answer.split("|")[0]]))});
 ok(short.right===5&&short.band===null&&short.percentage===100,"short result percentage, no Band");
 const writing=await request("/ielts/writing",{task:2,promptId:content.writing.task2[0].id,text:"This is demonstration text only. ".repeat(60)});
 const speaking=await request("/ielts/speaking",{part:2,prompt:"A useful book",transcript:"This is a demonstration of a speaking transcript. ".repeat(20),seconds:60});
 ok(writing.overall===null&&speaking.overall===null&&speaking.criteria.find((c:any)=>c.name==="Pronunciation").band===null,"demo API has no measured band");
 // Legacy demo rows with numeric scores remain stored but are normalised at read time.
 await db.execute({sql:"INSERT INTO ielts_submissions (user_id,kind,prompt_id,text,result,overall,at) VALUES (?,'writing2','legacy','demo',?,9,?)",args:[account.user.id,JSON.stringify({mode:"demo",overall:9,predicted:9,criteria:[]}),Date.now()]});
 const history=await request("/ielts/history");ok(history.every((h:any)=>h.overall===null),"legacy demo numeric history hidden");
 const dashboard=await request("/me/dashboard");ok(dashboard.ieltsEstimate===null,"demo records excluded from level analytics");
 let exam=await request("/ielts/reading-exam/start",{});ok(exam.endsAt>Date.now()+3590000,"server 60-minute deadline");
 ok(!("evidence" in exam.exam.passages[0].questions[0])&&!("answer" in exam.exam.passages[0].questions[0]),"exam keys/evidence stay server-side");
 await request(`/ielts/reading-exam/${exam.id}/answer`,{questionId:"1",value:"iv"});
 const restored=await request("/ielts/reading-exam/active");ok(restored.id===exam.id&&restored.answers["1"]==="iv"&&restored.endsAt===exam.endsAt,"exam restores deadline and answers");
 const result=await request(`/ielts/reading-exam/${exam.id}/finish`,{answers:Object.fromEntries(IELTS_ACADEMIC.passages.flatMap(p=>p.questions).map(q=>[q.id,q.answer]))});ok(result.right===40&&result.band===null,"all 40 exam keys accepted");
 const before=await db.execute({sql:"SELECT count(*) n FROM attempts WHERE user_id = ?",args:[account.user.id]});
 const again=await request(`/ielts/reading-exam/${exam.id}/finish`,{});ok(again.right===40,"idempotent exam completion");
 const after=await db.execute({sql:"SELECT count(*) n FROM attempts WHERE user_id = ?",args:[account.user.id]});ok(before.rows[0]!.n===after.rows[0]!.n,"completion does not duplicate attempts");
 await request(`/ielts/reading-exam/${exam.id}/answer`,{questionId:"2",value:"vi"},409);
 exam=await request("/ielts/reading-exam/start",{});
 await request(`/ielts/reading-exam/${exam.id}/answer`,{questionId:"1",value:"iv"});
 await db.execute({sql:"UPDATE ielts_reading_runs SET ends_at = ? WHERE id = ?",args:[Date.now()-1000,exam.id]});
 const expired=await request(`/ielts/reading-exam/${exam.id}/finish`,{answers:{"2":"vi"}});ok(expired.right===1,"expired exam uses only answers saved before deadline");
 const bad={id:"ent-quarantine-api",subject:"history-kz",topic:"Древнейшая история Казахстана",type:"single",lang:"ru",stem:"Товар стоил 1000 ₸, скидка 10%",options:["900","100","1100","990"],answer:0,explanation:"Discount",difficulty:"A",source:"seed"};
 await db.execute({sql:"INSERT INTO ent_questions (id,subject,topic,type,lang,data,created_at) VALUES (?,?,?,?,?,?,?)",args:[bad.id,bad.subject,bad.topic,bad.type,bad.lang,JSON.stringify(bad),Date.now()]});
 await db.execute({sql:"INSERT INTO attempts (user_id,module,item_id,skill,correct,ms,at) VALUES (?,'ent',?,'history-kz:Древнейшая история Казахстана',0,0,?)",args:[account.user.id,bad.id,Date.now()]});
 const available=await request("/ent/practice",{subject:"history-kz",topic:bad.topic,type:"single"});ok(!available.unavailable&&available.items.length>0&&available.items.every((q:any)=>q.source==="open"&&q.id!==bad.id),"real history content served, malformed demo excluded");
 const still=await db.execute({sql:"SELECT count(*) n FROM attempts WHERE item_id = ?",args:[bad.id]});ok(Number(still.rows[0]!.n)===1,"quarantined history attempt retained");
 await db.execute({sql:"INSERT INTO review_queue (user_id,module,item_id,stage,due_at,updated_at) VALUES (?,'ent',?,0,0,?)",args:[account.user.id,bad.id,Date.now()]});
 const review=await request("/review");ok(!review.due.ent.includes(bad.id)&&review.entItems.every((q:any)=>q.id!==bad.id),"quarantined item excluded from review and due counts");
 const queue=await db.execute({sql:"SELECT count(*) n FROM review_queue WHERE item_id = ?",args:[bad.id]});ok(Number(queue.rows[0]!.n)===1,"quarantined review schedule preserved");
 console.log(`${checks} API assertions passed on disposable database`);
} finally {db.close();child.kill("SIGTERM");}
