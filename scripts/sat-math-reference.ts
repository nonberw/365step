// Independent arithmetic reconstruction from conditions, adapted from the earlier audit.
import type { SatQuestion } from "../shared/types";
import { isCorrect } from "../shared/sat";
const num=(s:string)=>{
 const t=s.replace(/\$/g,'').replace(/\\frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}/g,'$1/$2').replace(/tenge|\s/g,'');
 if(t.includes('/')){const[a,b]=t.split('/').map(Number);return a/b;}
 return Number(t);
};
export function verifyGeneratedMath(questions: SatQuestion[]) {
const out:any[]=[];let checked=0;const byKey:Record<string,number>={};
for(const q of questions.filter(q=>q.section==='math'&&q.source==='generated')){
 const key=q.id.split('-')[1],s=q.stem;let want:number|undefined;
 let m:RegExpMatchArray|null;
 const nums=(t:string)=>[...t.matchAll(/-?\d+(?:\.\d+)?/g)].map(x=>Number(x[0]));
 if(key==='lin'&&(m=s.match(/\$(\d+)x ([+-]) (\d+) = (-?\d+)\$/)))want=(+m[4]-(m[2]==='+'?1:-1)*+m[3])/+m[1];
 if(key==='slope'){const[x,y,u,v]=nums(s);want=(v-y)/(u-x);}
 if(key==='cost'){const[fee,rate,total]=nums(s);want=(total-fee)/rate;}
 if(key==='sys'&&(m=s.match(/x \+ y = (-?\d+)\$\n\$(\d*)x - (\d*)y = (-?\d+)\$/)))want=(+m[4]+(+(m[3]||1))*+m[1])/((+(m[2]||1))+(+(m[3]||1)));
 if(key==='nosol'){const[a,b,c,b2,c2]=nums(s);want=a*b2/b;}
 if(key==='fval'&&(m=s.match(/= (\d*)x\^2 ([+-]) (\d+)\$.*f\((-?\d+)\)/)))want=+(m[1]||1)*(+m[4])**2+(m[2]==='+'?1:-1)*+m[3];
 if(key==='quad'&&(m=s.match(/x\^2 ([+-]) (\d+)x ([+-]) (\d+) = 0/))){const b=(m[1]==='+'?1:-1)*+m[2],c=(m[3]==='+'?1:-1)*+m[4];want=(-b+Math.sqrt(b*b-4*c))/2;}
 if(key==='growth'){
  const[p,pct,t]=nums(s);const answer=q.choices![q.answer as number];
  m=answer.match(/\$(\d+)\(([\d.]+)\)\^\{(\d+)\}\$/);
  if(!m)throw new Error(q.id+' invalid growth expression');
  const got=+m[1]*(+m[2])**+m[3];want=p*(1+pct/100)**t;
  checked++;byKey[key]=(byKey[key]||0)+1;if(Math.abs(want-got)>1e-7)out.push({id:q.id,got,want});continue;
 }
 if(key==='vertex'&&(m=s.match(/x\^2 ([+-]) (\d+)x ([+-]) (\d+)\$/))){const b=(m[1]==='+'?1:-1)*+m[2],c=(m[3]==='+'?1:-1)*+m[4];want=c-b*b/4;}
 if(key==='pct'){const[p,d]=nums(s);want=p*(1-d/100);}
 if(key==='mean'&&(m=s.match(/on (\d+) tests were (.+)\. What score.*test (\d+).*exactly (\d+)/))){want=+m[3]*+m[4]-nums(m[2]).reduce((a,b)=>a+b,0);}
 if(key==='prob'&&(m=s.match(/\| SAT \| (\d+) \| (\d+) \|\n\| IELTS \| (\d+) \| (\d+) \|/))){want=(+m[1]+ +m[3])/(+m[1]+ +m[2]+ +m[3]+ +m[4]);}
 if(key==='ratio'){const[v,t]=nums(s);want=v*t/60;}
 if(key==='circle'){const[r]=nums(s);const actual=q.choices![q.answer as number].match(/\$(\d+)\\pi\$/);if(!actual)throw new Error(q.id);want=r*r;checked++;byKey[key]=(byKey[key]||0)+1;if(+actual[1]!==want)out.push({id:q.id,got:+actual[1],want});continue;}
 if(key==='pyth'){const[a,b]=nums(s);want=Math.sqrt(a*a+b*b);}
 if(key==='trig'){const[a,b,c]=nums(s);want=a/c;}
 if(want===undefined)throw new Error('unparsed '+q.id);
 const got=q.choices?num(q.choices[q.answer as number]):num(String(q.answer));
 checked++;byKey[key]=(byKey[key]||0)+1;
 if(!Number.isFinite(got)||Math.abs(want-got)>1e-7)out.push({id:q.id,stem:q.stem,got,want,acceptsExact:isCorrect(q,String(want)),explanation:q.explanation});
}
return { checked, byKey, mismatches: out };
}
