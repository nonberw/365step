import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {SAT_ACTIVE_BANK,SAT_BANK,isCorrect} from '../shared/sat';
import {englishExamData,englishExamText,isEnglishExamCourse} from '../shared/examEnglish';
import {SAT_LESSONS} from '../shared/satLessons';
import {RichText} from '../src/components/RichText';
import {isEnglishExamRoute} from '../src/lib/examLanguage';
import * as ielts from '../server/content/ielts';
import {IELTS_ACADEMIC} from '../server/content/ieltsAcademic';
const ru=/[А-Яа-яЁё]/;
let count=0;
function english(value:unknown,path='') {if(typeof value==='string')assert.ok(!ru.test(value),`${path}: ${value}`);else if(Array.isArray(value))value.forEach((v,i)=>english(v,`${path}[${i}]`));else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))if(!['sourceUrl','url','href','evidence','quote','download'].includes(k))english(v,`${path}.${k}`)}
for(const q of SAT_ACTIVE_BANK){
 const translated=englishExamData(q);
 assert.equal(translated.id,q.id);assert.deepEqual(translated.answer,q.answer);assert.deepEqual(translated.acceptedAnswers,q.acceptedAnswers);
 assert.equal(translated.stem,q.stem);assert.deepEqual(translated.choices,q.choices);
 english(translated.explanation,q.id);
 assert.deepEqual(translated.explanation.match(/\$[^$]+\$/g),q.explanation.match(/\$[^$]+\$/g),`${q.id}: exact formulas`);
 assert.ok(isCorrect(q,q.answer));
 assert.doesNotMatch(renderToStaticMarkup(createElement(RichText,{text:translated.explanation,math:q.section==='math'})),/katex-error/,q.id);
 count++;
}
english(englishExamData(SAT_LESSONS),'SAT lessons');
for(const set of [...ielts.READING,...ielts.LISTENING])for(const q of set.questions)english(englishExamText(q.why),q.id);
english(englishExamData(IELTS_ACADEMIC),'IELTS Academic');
assert.equal(SAT_BANK.length,9803);assert.equal(SAT_ACTIVE_BANK.length,2751);
for(const route of ['/sat','/sat/q/id','/ielts','/ielts/reading','/learn/sat-math/s-id','/learn/sat-rw/s-id','/learn/ielts-reading/t-id'])assert.ok(isEnglishExamRoute(route));
for(const route of ['/ent','/profile','/learn/ent/e-id','/learn/code/p-id'])assert.ok(!isEnglishExamRoute(route));
assert.ok(isEnglishExamRoute('/learn','?course=sat-math'));assert.ok(!isEnglishExamRoute('/learn','?course=ent'));
assert.ok(isEnglishExamCourse('sat-math'));assert.ok(!isEnglishExamCourse('ent'));
assert.equal(englishExamData({id:'q1',answer:'3/4',given:'3/4',text:'original student text'}).text,'original student text');
delete process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_AUTH_TOKEN;
const {ieltsWriting,ieltsSpeaking}=await import('../server/ai');
const writing=await ieltsWriting(2,'A practice prompt','A short practice response with a clear main idea.');english(writing);assert.equal(writing.overall,null);
const speaking=await ieltsSpeaking(1,'A practice question','I enjoy studying with my friends.',10);english(speaking);assert.equal(speaking.overall,null);
console.log(`${count} active SAT explanations, formulas and keys checked; IELTS feedback and language boundaries pass`);
