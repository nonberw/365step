import { SAT_BANK, SAT_ACTIVE_BANK } from "../shared/sat";
import { SAT_ORIGINAL } from "../shared/satOriginal";
import { fingerprint } from "../shared/satQuality";
import { PROBLEMS } from "../shared/problems";
import { CODING_EDGES } from "../shared/codingEdges";
import { READING } from "../server/content/ielts";
import { IELTS_ACADEMIC } from "../server/content/ieltsAcademic";
function count<T>(items:T[],key:(v:T)=>string|number){const out:Record<string,number>={};for(const v of items)out[key(v)]=(out[key(v)]??0)+1;return out;}
const groups=new Map<string,string[]>();for(const q of SAT_BANK){const key=fingerprint(q);groups.set(key,[...(groups.get(key)??[]),q.id]);}
console.log(JSON.stringify({
 sat:{total:SAT_BANK.length,active:SAT_ACTIVE_BANK.length,sections:count(SAT_BANK,q=>q.section),activeSections:count(SAT_ACTIVE_BANK,q=>q.section),difficulty:count(SAT_BANK,q=>q.difficulty),activeDifficulty:count(SAT_ACTIVE_BANK,q=>q.difficulty),purposes:count(SAT_ACTIVE_BANK,q=>q.purpose!),activeByTopic:count(SAT_ACTIVE_BANK,q=>`${q.section}: ${q.domain} / ${q.skill}`),positions:count(SAT_BANK.filter(q=>q.section==="math"&&q.choices),q=>"ABCD"[Number(q.answer)]!),underlined:SAT_BANK.filter(q=>/__[\s\S]+?__/.test(q.passage??"")).map(q=>q.id),duplicates:[...groups.values()].filter(g=>g.length>1),aliases:SAT_BANK.filter(q=>q.canonicalId!==q.id).map(q=>({id:q.id,canonicalId:q.canonicalId})),reclassified:SAT_BANK.filter(q=>q.difficultyReview).map(q=>({id:q.id,from:3,to:q.difficulty,reason:q.difficultyReview!.reason})),added:SAT_ORIGINAL.map(q=>({id:q.id,words:q.passage!.split(/\s+/).length,difficulty:q.difficulty})),rwLengths:{under25:SAT_BANK.filter(q=>q.section==="rw"&&(q.passage??"").split(/\s+/).filter(Boolean).length<25).length,max:Math.max(...SAT_BANK.filter(q=>q.section==="rw").map(q=>(q.passage??"").split(/\s+/).length))}},
 reading:{shortSets:READING.length,shortQuestions:READING.reduce((n,r)=>n+r.questions.length,0),uniqueShortPassages:new Set(READING.map(r=>r.passage.toLowerCase().replace(/\s+/g," ").trim())).size,fullExams:1,fullPassages:3,fullWords:IELTS_ACADEMIC.passages.map(p=>p.passage.split(/\s+/).length),fullQuestions:40},
 coding:{problems:PROBLEMS.length,tests:PROBLEMS.reduce((n,p)=>n+p.tests.length,0),edgeCases:Object.values(CODING_EDGES).flat().length,referenceSolutions:64}
},null,2));
