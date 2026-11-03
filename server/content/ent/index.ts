import "./numeric";
import "./history";
import "./world";
import "./law";
import "./science";
import "./relations";
import "./languages";
import "./literature";
import "./language-relations";
import "./contexts";
import "./text-contexts";
import {items} from "./builders";
import type {EntQuestion} from "../../../shared/ent";

/** Runtime objects contain no generator parameters, reference answers or source code. */
export const ENT_OPEN:EntQuestion[]=[...items];
export const ENT_OPEN_BY_ID=new Map(ENT_OPEN.map(q=>[q.id,q]));
export function entOpenCoverage(subject:string,lang:string){
 const qs=ENT_OPEN.filter(q=>q.subject===subject&&q.lang===lang);
 const count=(key:(q:EntQuestion)=>string)=>Object.fromEntries([...new Set(qs.map(key))].map(k=>[k,qs.filter(q=>key(q)===k).length]));
 return {total:qs.length,concepts:new Set(qs.filter(q=>!q.variant).map(q=>q.contentId)).size,variants:qs.filter(q=>q.variant).length,byType:count(q=>q.type),difficulty:count(q=>q.difficulty),byTopic:count(q=>q.topic)};
}
