import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=process.env.EXAM_EN_WORK!;
const parser=createRequire(`${root}/package.json`)('@babel/parser');
const translations:Record<string,string>={...JSON.parse(readFileSync(`${root}/translations.json`,'utf8')),...JSON.parse(readFileSync('scripts/english-exams/overrides.json','utf8'))};
const locations: {file:string;start:number;end:number;kind:string;text:string}[]=JSON.parse(readFileSync(`${root}/locations.json`,'utf8'));
const mixed=['src/pages/learn/Lesson.tsx','src/pages/learn/Path.tsx','src/components/Blitz.tsx'];
const direct=locations.filter(x=>x.file.startsWith('src/pages/sat/')||x.file.startsWith('src/pages/ielts/')||x.file.startsWith('src/components/sat/')||x.file==='server/routes/sat.ts'||x.file==='server/routes/ielts.ts'||x.file==='shared/ieltsAssessment.ts');
const ui:Record<string,string>={};
for(const loc of locations.filter(x=>x.file.startsWith('src/')))if(translations[loc.text])ui[loc.text]=translations[loc.text]!;
Object.assign(ui,JSON.parse(readFileSync('scripts/english-exams/overrides.json','utf8')));
for(const file of new Set(locations.map(x=>x.file))){
 let code=readFileSync(file,'utf8');const isMixed=mixed.includes(file);
 const ranges:{start:number;end:number;name:string}[]=[];
 const tree=parser.parse(code,{sourceType:'module',plugins:['typescript',...(file.endsWith('tsx')?['jsx']:[])]});
 function visit(n:any){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name)ranges.push({start:n.start,end:n.end,name:n.id.name});for(const[k,v]of Object.entries(n)){if(['loc','extra','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}}visit(tree);
 const aiNames=['satExplain','satRemix','satHint','satGenerate','studyPlan','demoPlan','demoWriting','demoSpeaking'];
 let selected=locations.filter(x=>x.file===file&&(isMixed||direct.includes(x)||file==='server/ai.ts'&&ranges.some(r=>aiNames.includes(r.name)&&x.start>=r.start&&x.end<=r.end)));
 // General platform labels in Page/AppShell remain Russian; selected shared components use scoped copy below.
 const usedOwners=new Set<string>();
 for(const loc of selected.sort((a,b)=>b.start-a.start)){
  const translated=translations[loc.text];
  if(!translated){console.log('MISSING',file,JSON.stringify(loc.text));continue}
  const value=isMixed?loc.text:translated;
  const literal=JSON.stringify(value);
  let replacement:string;
  if(isMixed){
   const owner=ranges.filter(r=>/^[A-Z]/.test(r.name)&&loc.start>=r.start&&loc.end<=r.end).sort((a,b)=>b.start-a.start)[0];
   if(!owner)continue;usedOwners.add(owner.name);
   replacement=loc.kind==='JSXText'||loc.kind==='JSXAttributeString'?`{t(${literal})}`:loc.kind==='TemplateElement'?`\${t(${literal})}`:`t(${literal})`;
  }else{
   replacement=loc.kind==='JSXText'?translated.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/{/g,'&#123;').replace(/}/g,'&#125;'):loc.kind==='JSXAttributeString'?`{${literal}}`:loc.kind==='TemplateElement'?translated.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${'):literal;
  }
  code=code.slice(0,loc.start)+replacement+code.slice(loc.end);
 }
 if(isMixed){
  code='import { useExamCopy } from "@/lib/examLanguage";\n'+code;
  for(const owner of usedOwners){const re=new RegExp('((?:export default )?function '+owner+'\\([^]*?\\)\\s*\\{)');code=code.replace(re,'$1\n  const t = useExamCopy();');}
 }
 if(selected.length)writeFileSync(file,code);
}
writeFileSync('shared/examEnglish.json',JSON.stringify(translations,null,2)+'\n');
writeFileSync('src/lib/examUi.en.json',JSON.stringify(ui,null,2)+'\n');
console.log('Published',Object.keys(translations).length,'translations;',Object.keys(ui).length,'shared UI entries');
