import assert from "node:assert/strict";
import {writeFileSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import katex from "katex";
import {ENT_OPEN,entOpenCoverage} from "../server/content/ent";
import {ENT_OPEN_SOURCES} from "../server/content/ent/sources";
import {ENT_SUBJECTS,entScore,entPoints} from "../shared/ent";
import {entContentIssue} from "../shared/entQuality";
import {chooseEnt,chooseEntContexts} from "../server/entSelection";
import {numericEqual} from "../shared/numeric";
let checks=0;
function ok(condition:unknown,message:string){assert.ok(condition,message);checks++;}
const ids=new Set<string>(),fingerprints=new Set<string>();
const groups=new Map<string,typeof ENT_OPEN>();
for(const q of ENT_OPEN){
 ok(!ids.has(q.id),`duplicate id ${q.id}`);ids.add(q.id);
 ok(q.id.length<=40,`id exceeds API limit: ${q.id}`);
 ok(!entContentIssue(q),`${q.id}: ${entContentIssue(q)}`);
 ok(entScore(q,q.answer)===entPoints(q.type),`${q.id}: key rejected`);
 ok(entScore(q,[-1])===0&&entScore(q,[NaN])===0,`${q.id}: invalid response`);
 const texts=[q.stem,...q.options,...q.left??[],q.passage??"",q.explanation];
 for(const text of texts){
  ok(text.split('$').length%2===1,`${q.id}: unmatched math delimiter`);
  text.split('$').forEach((part,i)=>{if(i%2)katex.renderToString(part,{throwOnError:true,strict:'ignore'});else ok(!/\\(?:frac|sqrt|nu|geq|leq|cdot|times)\b/.test(part),`${q.id}: undelimited math: ${part}`);});
 }
 const fp=JSON.stringify([q.subject,q.lang,q.type,q.stem,q.options,q.left,q.passage]);
 ok(!fingerprints.has(fp),`${q.id}: duplicate complete condition`);fingerprints.add(fp);
 if(q.groupId)groups.set(q.groupId,[...groups.get(q.groupId)??[],q]);
 if(q.type==='multi')ok(entScore(q,[0,0])===0,`${q.id}: duplicate multi input`);
 if(q.type==='match')ok(entScore(q,[...(q.answer as number[]),0])===0,`${q.id}: trailing match input`);
 if(q.type==='match')ok(entScore(q,[(q.answer as number[])[0]!,99])===0,`${q.id}: out-of-range match input`);
}
for(const [id,g]of groups){ok(g.length===5,`${id}: complete group`);ok(new Set(g.map(q=>q.passage)).size===1,`${id}: coherent passage`);}
// Independent worked references for the shared numerical cases (not the builder's keys).
const f=(x:number)=>-x*x+12*x+45;
const circuitR=1/(1/6+1/3),current=12/(1+circuitR),voltage=current*circuitR;
const acid=0.5*1,base=0.25*1,salt=Math.min(acid,base);
const gametes=['AB','Ab','aB','ab'];const offspring=gametes.flatMap(a=>gametes.map(b=>[a[0]!+b[0]!,a[1]!+b[1]!]));
const probability=(fn:(x:string[])=>boolean)=>offspring.filter(fn).length/offspring.length;
const marks=[70,90,80,60,100,75];
const worked:Record<string,number[]>={
 'cx-math':[12/2,f(6),-2*4+12,(12+Math.sqrt(12**2-4*32))/2,f(6)-f(2)],
 'cx-circuit':[circuitR,current,voltage,current*voltage,current**2*1*2],
 'cx-neutral':[acid,salt,salt*58.5,acid-salt,0.5+0.25],
 'cx-cross':[gametes.length,probability(([a,b])=>a!.includes('A')&&b!.includes('B')),probability(([a,b])=>a==='aa'&&b==='bb'),probability(([a,b])=>new Set(a).size===2&&new Set(b).size===2),160*probability(([a,b])=>a!.includes('A')&&b==='bb')],
 'cx-pop':[1500-700,300-900,100000+1500-700+300-900,(1500-700)*1000/100000,1500-700+300-900],
 'cx-sql':[marks.reduce((a,b)=>a+b,0),marks.filter(v=>v>=80).length,marks.slice(0,3).reduce((a,b)=>a+b,0)/3,Math.max(...marks),new Set(['A','A','A','B','B','B']).size],
};
for(const [prefix,values]of Object.entries(worked))for(const lang of ['ru','kk'])values.forEach((value,i)=>{const q=ENT_OPEN.find(q=>q.id===`eo-${prefix}-${i+1}-${lang}`)!;ok(!!q&&numericEqual(q.options[q.answer as number],value),`${prefix}/${i+1}/${lang}: independent worked reference`);});
for(const s of ENT_SUBJECTS)for(const lang of s.fixedLang?[s.fixedLang]:['ru','kk']){
 const pool=ENT_OPEN.filter(q=>q.subject===s.id&&q.lang===lang);
 for(const topic of s.topics)ok(pool.some(q=>q.topic===topic),`${s.id}/${lang}: missing ${topic}`);
 for(const part of s.plan){const ofType=pool.filter(q=>q.type===part.type);const selected=part.type==='context'?chooseEntContexts(ofType,part.count,new Set(),Math.random,true):chooseEnt(ofType,part.count);
 ok(selected.length===part.count,`${s.id}/${lang}/${part.type}: full exam block`);
 ok(new Set(selected.map(q=>q.id)).size===part.count,`${s.id}: no repeated IDs`);
 const review=part.type==='context'?chooseEntContexts(ofType,part.count,new Set(ofType.map(q=>q.id)),Math.random,true):chooseEnt(ofType,part.count,new Set(ofType.map(q=>q.id)));
 ok(review.length===part.count,`${s.id}: exhausted material still repeatable`);
 }
}
const concepts=new Set(ENT_OPEN.map(q=>q.contentId)).size;
const manifest={date:'2026-11-03',total:ENT_OPEN.length,conditionsAcrossLanguages:concepts,nonVariantConditions:new Set(ENT_OPEN.filter(q=>!q.variant).map(q=>q.contentId)).size,numericVariants:new Set(ENT_OPEN.filter(q=>q.variant).map(q=>q.contentId)).size,numericFamilies:new Set(ENT_OPEN.filter(q=>q.variant).map(q=>q.familyId)).size,topics:ENT_SUBJECTS.reduce((n,s)=>n+s.topics.length,0),subjects:ENT_SUBJECTS.map(s=>({id:s.id,name:s.name,topics:s.topics.length,languages:Object.fromEntries((s.fixedLang?[s.fixedLang]:['ru','kk']).map(lang=>[lang,entOpenCoverage(s.id,lang)]))}))};
mkdirSync('docs/content/ent',{recursive:true});writeFileSync('docs/content/ent/manifest.json',JSON.stringify(manifest,null,2)+'\n');
if(process.argv.includes('--export')){
 const content={...manifest,license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',notice:'Original 365step educational adaptations; not official NCT questions. Language versions and parameter variants are counted separately. Difficulty labels are editorial and uncalibrated.',sources:ENT_OPEN_SOURCES,questions:ENT_OPEN};
 const data=JSON.stringify(content,null,2)+'\n';mkdirSync('public/content',{recursive:true});writeFileSync('public/content/ent-open-2026.json',data);writeFileSync('docs/content/ent/export-sha256.txt',createHash('sha256').update(data).digest('hex')+'\n');
}
console.log(`ENT: ${ENT_OPEN.length} language versions, ${concepts} conditions, ${manifest.nonVariantConditions} non-variant, ${manifest.numericFamilies} numeric families, 16 subjects / ${manifest.topics} topics; ${checks} assertions passed`);
