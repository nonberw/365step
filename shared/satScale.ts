import type { SatQuestion } from "./types";
import source from "./satScaleSource.json";
import practice from "./satScalePractice.json";
import { SAT_SCALE_READING } from "./satScaleReading";

export const SAT_SCALE_SOURCE = source as SatQuestion[];
export const SAT_SCALE_PRACTICE = practice as SatQuestion[];

/** Round-robin by structural family, so the bank does not begin with 100
 * changes of numbers in the same template. Stable IDs and keys are retained. */
function interleave(items:SatQuestion[]):SatQuestion[]{
  const families=new Map<string,SatQuestion[]>();
  for(const q of items){const key=q.familyId!;const group=families.get(key)??[];group.push(q);families.set(key,group);}
  const groups=[...families.values()];const result:SatQuestion[]=[];
  for(let i=0;groups.some(g=>i<g.length);i++)for(const group of groups)if(group[i])result.push(group[i]!);
  return result;
}
const pools=[interleave(SAT_SCALE_SOURCE),SAT_SCALE_READING,interleave(SAT_SCALE_PRACTICE)];
export const SAT_SCALE: SatQuestion[]=[];
for(let i=0;pools.some(p=>i<p.length);i++)for(const pool of pools)if(pool[i])SAT_SCALE.push(pool[i]!);
