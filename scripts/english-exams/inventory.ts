import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {SAT_BANK} from '../../shared/sat';
import {SAT_LESSONS} from '../../shared/satLessons';
import {VOCAB} from '../../shared/vocab';
import * as ielts from '../../server/content/ielts';
import {IELTS_ACADEMIC} from '../../server/content/ieltsAcademic';
import {COURSES,SKILL_RU} from '../../shared/path';
import {DOMAIN_RU,DIFFICULTY_RU} from '../../shared/types';
const ru=/[А-Яа-яЁё]/;
const root=process.env.EXAM_EN_WORK!;
const uiFiles=['src/pages/sat','src/pages/ielts','src/components/sat'].flatMap(d=>readdirSync(d).filter(f=>/\.tsx?$/.test(f)).map(f=>`${d}/${f}`));
const apiFiles=['server/routes/sat.ts','server/routes/ielts.ts'];
const extraFiles=['server/ai.ts','server/routes/path.ts','src/pages/learn/Lesson.tsx','src/pages/learn/Path.tsx','src/components/Blitz.tsx','src/components/Page.tsx','src/components/AppShell.tsx','shared/ieltsAssessment.ts','src/lib/vibe.ts'];
const locations: {file:string;start:number;end:number;kind:string;text:string}[]=[];
for(const file of [...uiFiles,...apiFiles,...extraFiles]){
 const parser=createRequire(`${root}/package.json`)('@babel/parser');
 const tree=parser.parse(readFileSync(file,'utf8'),{sourceType:'module',plugins:['typescript',...(file.endsWith('tsx')?['jsx']:[])]});
 const visit=(n:any,parent?:any)=>{if(!n||typeof n!=='object')return;
 const text=n.type==='StringLiteral'?n.value:n.type==='TemplateElement'?n.value.cooked:n.type==='JSXText'?n.value:null;
 if(typeof text==='string'&&ru.test(text))locations.push({file,start:n.start,end:n.end,kind:parent?.type==='JSXAttribute'&&n.type==='StringLiteral'?'JSXAttributeString':n.type,text});
 for(const [key,value]of Object.entries(n)){if(['loc','extra','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(child=>visit(child,n));else if(value&&typeof value==='object')visit(value,n)}
 };visit(tree);
}
const strings=new Set(locations.map(x=>x.text));
function collect(x:unknown){if(typeof x==='string'&&ru.test(x))strings.add(x);else if(Array.isArray(x))x.forEach(collect);else if(x&&typeof x==='object')Object.values(x).forEach(collect)}
collect(SAT_BANK);collect(SAT_LESSONS);collect(VOCAB);collect(ielts);collect(IELTS_ACADEMIC);collect(COURSES);collect(SKILL_RU);collect(DOMAIN_RU);collect(DIFFICULTY_RU);
writeFileSync(`${root}/locations.json`,JSON.stringify(locations,null,2));
writeFileSync(`${root}/strings.json`,JSON.stringify([...strings],null,2));
console.log({strings:strings.size,locations:locations.length,uiFiles:uiFiles.length});
