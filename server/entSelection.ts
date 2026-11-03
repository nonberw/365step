import type {EntQuestion} from "../shared/ent";

/** Prefer unseen material and distribute variants across structural families.
 * Difficulty and requested topics are filtered by the caller and never relaxed. */
export function chooseEnt(pool:EntQuestion[],count:number,seen=new Set<string>(),random=Math.random):EntQuestion[]{
 const chosen:EntQuestion[]=[];const families=new Map<string,number>();
 const candidates=pool.map(q=>({q,tie:random()}));
 while(chosen.length<count&&candidates.length){
  candidates.sort((a,b)=>Number(seen.has(a.q.id))-Number(seen.has(b.q.id))||(families.get(a.q.familyId??a.q.id)??0)-(families.get(b.q.familyId??b.q.id)??0)||a.tie-b.tie);
  const q=candidates.shift()!.q;chosen.push(q);const f=q.familyId??q.id;families.set(f,(families.get(f)??0)+1);
 }
 return chosen;
}
export function chooseEntContexts(pool:EntQuestion[],count:number,seen=new Set<string>(),random=Math.random,complete=false):EntQuestion[]{
 const groups=new Map<string,EntQuestion[]>();
 for(const q of pool){const key=q.groupId??q.id;groups.set(key,[...(groups.get(key)??[]),q]);}
 const ordered=[...groups.values()].filter(g=>!complete||g.length===5).map(g=>({g,n:g.filter(q=>seen.has(q.id)).length,tie:random()})).sort((a,b)=>a.n-b.n||a.tie-b.tie);
 const out:EntQuestion[]=[];
 for(const {g} of ordered){if(out.length+g.length>count)continue;out.push(...g);if(out.length===count)break;}
 return out;
}
