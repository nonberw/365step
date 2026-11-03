import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import katex from 'katex';
import {ENT_SOURCE_BANK,ENT_SOURCE_META,ENT_SOURCE_ATTRIBUTIONS,sourceCorrect,sourcePublic} from '../server/content/ent/source-bank';
import {ENT_SUBJECT} from '../shared/ent';
import {choiceKey} from '../shared/numeric';
const issues:{id:string;reason:string}[]=[];let checks=0;
const ok=(test:unknown,id:string,reason:string)=>{checks++;if(!test)issues.push({id,reason});};
const ids=new Set<string>();const seen=new Set<string>();const groups=new Map<string,typeof ENT_SOURCE_BANK>();
for(const q of ENT_SOURCE_BANK){
 ok(!ids.has(q.id),q.id,'duplicate-id');ids.add(q.id);
 ok(!!ENT_SUBJECT[q.subject],q.id,'unknown-subject');ok(!ENT_SUBJECT[q.subject]?.fixedLang||q.lang===ENT_SUBJECT[q.subject]!.fixedLang,q.id,'wrong-subject-language');
 ok(q.stem.length>=12&&q.explanation.length>20&&!!q.sourceRef&&!!q.conditionId,q.id,'missing-content');
 ok(ENT_SOURCE_ATTRIBUTIONS.some(s=>s.id===q.sourceId),q.id,'unknown-source');
 const pub=sourcePublic(q);for(const key of ['answer','accepted','evidence','evidenceUrl','explanation'])ok(!(key in pub),q.id,'public-leak-'+key);
 ok(q.level===undefined||q.review==='independent-math-verified',q.id,'unsupported-difficulty-label');
 const fp=JSON.stringify([q.lang,q.stem,q.passage]);ok(!seen.has(fp),q.id,'duplicate-condition');seen.add(fp);
 if(q.kind==='choice'){
  ok(q.options?.length===4&&Number.isInteger(q.answer)&&q.answer!>=0&&q.answer!<=3,q.id,'invalid-choice-key');
  const keys=q.options!.map(o=>{const k=choiceKey(o);return /^-?\d+\/\d+$/.test(k)?k:o.trim();});ok(new Set(keys).size===4,q.id,'equivalent-numeric-options');
  ok(sourceCorrect(q,q.answer),q.id,'choice-key-rejected');ok(!sourceCorrect(q,String(q.answer))&&!sourceCorrect(q,99),q.id,'invalid-choice-input');
 }else{
  ok(!!q.accepted?.length,q.id,'missing-short-key');for(const a of q.accepted??[])ok(sourceCorrect(q,a),q.id,'short-key-rejected');
  ok(!sourceCorrect(q,'')&&!sourceCorrect(q,[]),q.id,'invalid-short-input');
 }
 if(q.sourceId==='kazqad'){
  ok(!!q.evidence&&q.accepted!.some(a=>q.evidence!.includes(a)),q.id,'answer-not-in-evidence');
  ok(q.evidenceUrl?.startsWith('https://kk.wikipedia.org/wiki/'),q.id,'untrusted-evidence-url');
  ok(!q.passage,q.id,'gold-evidence-exposed-before-check');
 }
 if(q.sourceId==='belebele'){
  ok(!!q.passage&&q.passage.length>100,q.id,'missing-comprehension-passage');
  groups.set(q.conditionId,[...(groups.get(q.conditionId)??[]),q]);
 }
 // Readability: reject malformed source LaTeX rather than shipping red parse errors.
 for(const body of [q.stem,...q.options??[],q.passage??'',q.explanation]){
  if(q.sourceId==='belebele')continue; // This source contains prose currency symbols, not TeX.
  if(body.split('$').length%2===0){ok(false,q.id,'unbalanced-math');continue;}
  body.split('$').forEach((part,i)=>{if(i%2)try{katex.renderToString(part,{throwOnError:true,strict:'ignore'});}catch(e){ok(false,q.id,'invalid-math: '+(e as Error).message.slice(0,120));}});
 }
}
for(const [id,qs]of groups){ok(new Set(qs.map(q=>q.lang)).size===qs.length,id,'duplicate-translation');ok(new Set(qs.map(q=>q.answer)).size===1,id,'translation-key-disagrees');}
ok(ENT_SOURCE_META.total>=6000,'bank','insufficient-substantial-expansion');
for(const id of Object.keys(ENT_SUBJECT))ok(!!ENT_SOURCE_META.subjects[id],id,'missing-subject-source-practice');
mkdirSync('docs/content/ent/expansion',{recursive:true});
writeFileSync('docs/content/ent/expansion/validation.json',JSON.stringify({date:'2026-11-03',checks,records:ENT_SOURCE_META.total,conditions:ENT_SOURCE_META.conditions,issues},null,2)+'\n');
if(issues.length){console.log(JSON.stringify({checks,issues:issues.length,examples:issues.slice(0,20)},null,2));process.exitCode=1;}
else{
 console.log(`${checks} source-bank checks passed; ${ENT_SOURCE_META.total} language records, ${ENT_SOURCE_META.conditions} distinct conditions`);
 if(process.argv.includes('--export')){
  const licenses=Object.fromEntries(['kazqad-license.txt','belebele-license.txt','mera-license.txt','include-license.txt','rubq-license.txt'].map(name=>[name,readFileSync('docs/content/ent/expansion/'+name,'utf8')]));
  licenses['openstax-2026-08-CC-BY-4.0.txt']=readFileSync('docs/content/licenses/openstax-2026-08-CC-BY-4.0.txt','utf8');
  const json=JSON.stringify({schema:'365step-ent-sources-v1',date:'2026-11-03',notice:'Additional educational practice; not the official NCT bank. Source-language copies count separately. Original keys and per-source licenses retained; review state is not independent expert certification.',meta:ENT_SOURCE_META,licenses,questions:ENT_SOURCE_BANK});
  mkdirSync('public/content',{recursive:true});writeFileSync('public/content/ent-source-bank-2026.json.gz',gzipSync(json,{level:9}));
  writeFileSync('docs/content/ent/expansion/export-sha256.txt',createHash('sha256').update(json).digest('hex')+'\n');
 }
}
assert.ok(ids.size===ENT_SOURCE_BANK.length,'stable IDs');
assert.equal(issues.length,0,'source quality checks must pass before use');
