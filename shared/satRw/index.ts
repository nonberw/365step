import { build } from "./build";
import { READING_ITEMS } from "./reading";
import { VOCABULARY_ITEMS } from "./vocabulary";
import { PAIRED_ITEMS } from "./paired";
import { TRANSITION_ITEMS } from "./transitions";
import { SYNTHESIS_ITEMS } from "./synthesis";
import { GRAMMAR_ITEMS } from "./grammar";

// Interleave skills so the collection's first page is representative.
const groups = [READING_ITEMS,VOCABULARY_ITEMS,PAIRED_ITEMS,TRANSITION_ITEMS,SYNTHESIS_ITEMS,GRAMMAR_ITEMS];
const items = [];
for (let i = 0; groups.some(group=>i<group.length); i++) {
  for (const group of groups) if(group[i]) items.push(group[i]!);
}
// Spread primary works as well as skills across the first pages. Rotate the
// choices before reordering so published IDs retain their option/key mapping.
const built = build(items);
const sources = new Map<string, typeof built>();
for(const q of built){
  const id=q.attribution!.sourceId;
  const group=sources.get(id)??[]; group.push(q); sources.set(id,group);
}
export const SAT_RW_EXPANSION: typeof built = [];
for(let i=0;[...sources.values()].some(group=>i<group.length);i++){
  for(const group of sources.values())if(group[i])SAT_RW_EXPANSION.push(group[i]!);
}
