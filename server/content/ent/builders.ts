import { ENT_SUBJECT, type EntQuestion, type EntType } from "../../../shared/ent";
import { ENT_OPEN_SOURCES } from "./sources";
export type Bi=string|readonly [string,string];
export const text=(value:Bi,lang:string)=>(typeof value==="string"?value:value[lang==="kk"?1:0]).split("$").map((part,i)=>i%2?part:part.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,"($1/$2)")).join("$");
export const items:EntQuestion[]=[];
const hash=(s:string)=>[...s].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7);
export function add(subject:string,topic:number,id:string,difficulty:"A"|"B"|"C",stem:Bi,options:Bi[],answer:number|number[],why:Bi,sourceId:string,locator:string,extra:{type?:EntType;passage?:Bi;group?:string;left?:Bi[];variant?:boolean;family?:string}={}){
  const spec=ENT_SUBJECT[subject]!;if(!spec)throw Error(subject);
  const contentId="eo-"+id;
  for(const lang of spec.fixedLang?[spec.fixedLang]:["ru","kk"] as const){
    const permutation=options.map((_,i)=>i);const shift=hash(contentId)%options.length;
    permutation.push(...permutation.splice(0,shift));
    const type=extra.type??"single";
    const key=Array.isArray(answer)?answer.map(a=>permutation.indexOf(a)):permutation.indexOf(answer);
    const source=ENT_OPEN_SOURCES[sourceId];if(!source)throw Error(sourceId);
    items.push({id:contentId+"-"+lang,contentId,familyId:extra.family??contentId,subject,topic:spec.topics[topic]!,type,lang,difficulty,source:"open",stem:text(stem,lang),options:permutation.map(i=>text(options[i]!,lang)),answer:type==="multi"?(key as number[]).sort((a,b)=>a-b):key,explanation:text(why,lang),...(extra.passage?{passage:text(extra.passage,lang)}:{}),...(extra.group?{groupId:extra.group+"-"+lang}:{}),...(extra.left?{left:extra.left.map(v=>text(v,lang))}:{}),...(extra.variant?{variant:true}:{}),attribution:{sourceId,title:source.title,authors:source.authors,url:source.url,locator,sourceLicense:source.license,sourceLicenseUrl:source.licenseUrl,license:"CC BY-SA 4.0",licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",changes:lang==="kk"?"365step: ашық материал негізінде жаңа оқу тапсырмасы, аударма, жауап нұсқалары және түсіндірме. Ресми ҰТО тапсырмасы емес.":"365step: новое учебное задание по открытому материалу, перевод, варианты и объяснение. Это не официальное задание НЦТ.",checkedAt:"2026-11-03"}});
  }
}
export function single(subject:string,topic:number,id:string,level:"B"|"C",stem:Bi,options:Bi[],why:Bi,source:string,locator:string){add(subject,topic,id,level,stem,options,0,why,source,locator);}
export function multi(subject:string,topic:number,id:string,level:"B"|"C",stem:Bi,options:Bi[],answers:number[],why:Bi,source:string,locator:string){add(subject,topic,id,level,stem,options,answers,why,source,locator,{type:"multi"});}
export function match(subject:string,topic:number,id:string,stem:Bi,left:Bi[],options:Bi[],answers:number[],why:Bi,source:string,locator:string){add(subject,topic,id,"B",stem,options,answers,why,source,locator,{type:"match",left});}
export function context(subject:string,topic:number,id:string,passage:Bi,questions:{stem:Bi;options:Bi[];why:Bi;level?:"B"|"C";topic?:number}[],source:string,locator:string){
  if(questions.length!==5)throw Error("Context must have five questions: "+id);
  questions.forEach((q,i)=>add(subject,q.topic??topic,id+"-"+(i+1),q.level??"B",q.stem,q.options,0,q.why,source,locator,{type:"context",passage,group:"eog-"+id}));
}
