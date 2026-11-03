import records from "./numeric-data.json";
import { add, type Bi } from "./builders";
for(const rec of records){
  add(rec.subject,rec.topic,rec.id,rec.level as "B"|"C",rec.stem as unknown as Bi,rec.options,0,rec.why as unknown as Bi,rec.source,`Local 365step parameter model: ${rec.family}; open textbook method, not copied examination content`,{variant:true,family:"ent-numeric:"+rec.family});
}
