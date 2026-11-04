import assert from 'node:assert/strict';
import { DIRECTIONS, findDirections, getDirection, validateDirectionId } from '../../shared/directions';
assert.equal(DIRECTIONS.length,27);
assert.equal(new Set(DIRECTIONS.map(d=>d.id)).size,27);
assert.equal(DIRECTIONS.flatMap(d=>d.modules).length,135);
assert.equal(new Set(DIRECTIONS.flatMap(d=>d.modules.map(m=>m.id))).size,135);
for (const d of DIRECTIONS) { assert.equal(d.modules.length,5); assert.ok(d.sources.length>=2); }
for (const [q,id] of [['стоматолог','medicine'],['пилот','transport'],['предприниматель','business']]) assert.ok(findDirections(q!).some(d=>d.id===id));
for (const bad of [null,[],['it','business'],'unknown',{},42]) assert.throws(()=>validateDirectionId(bad));
assert.equal(getDirection('business')?.modules.length,5);
console.log('Direction catalogue checks passed');
