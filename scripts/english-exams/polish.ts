import {readFileSync,writeFileSync} from 'node:fs';
import{createRequire}from'node:module';
const root=process.env.EXAM_EN_WORK!;const parser=createRequire(`${root}/package.json`)('@babel/parser');
const fixes:Record<string,string>=JSON.parse(readFileSync('scripts/english-exams/polish.json','utf8'));
function polish(s:string){const value=fixes[s.trim()];return value===undefined?s:s.replace(s.trim(),value)}
const locations:{file:string}[]=JSON.parse(readFileSync(`${root}/locations.json`,'utf8'));
for(const file of new Set(locations.map(x=>x.file).filter(f=>f.startsWith('src/pages/sat/')||f.startsWith('src/pages/ielts/')||f.startsWith('src/components/sat/')))){
 let code=readFileSync(file,'utf8');const edits:{start:number;end:number;kind:string;text:string}[]=[];
 const visit=(n:any,parent?:any)=>{if(!n||typeof n!=='object')return;const text=n.type==='StringLiteral'?n.value:n.type==='TemplateElement'?n.value.cooked:n.type==='JSXText'?n.value:null;
 if(!(n.type==='JSXText'&&parent?.openingElement?.name?.name==='text')&&typeof text==='string'&&polish(text)!==text)edits.push({start:n.start,end:n.end,kind:parent?.type==='JSXAttribute'?'attribute':n.type,text});
 for(const[k,v]of Object.entries(n)){if(['loc','extra','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(c=>visit(c,n));else if(v&&typeof v==='object')visit(v,n)}};
 visit(parser.parse(code,{sourceType:'module',plugins:['typescript',...(file.endsWith('tsx')?['jsx']:[])]}));
 for(const e of edits.sort((a,b)=>b.start-a.start)){const t=polish(e.text),lit=JSON.stringify(t);const out=e.kind==='JSXText'?t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/{/g,'&#123;').replace(/}/g,'&#125;'):e.kind==='attribute'?`{${lit}}`:e.kind==='TemplateElement'?t.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${'):lit;code=code.slice(0,e.start)+out+code.slice(e.end)}
 writeFileSync(file,code)
}
for(const file of ['shared/examEnglish.json','src/lib/examUi.en.json']){const data:Record<string,string>=JSON.parse(readFileSync(file,'utf8'));for(const key of Object.keys(data))data[key]=polish(data[key]!);writeFileSync(file,JSON.stringify(data,null,2)+'\n')}
