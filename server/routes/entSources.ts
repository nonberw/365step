import {Router} from 'express';
import {requireStudent} from '../auth';
import {all,run,addXp} from '../db';
import {wrap,must,str} from '../http';
import {ENT_SOURCE_BANK,ENT_SOURCE_META,ENT_SOURCE_BY_ID,sourcePublic,sourceCorrect} from '../content/ent/source-bank';
import type {EntSourceQuestion} from '../../shared/entSources';
export const entSourcesRouter=Router();
const filtered=(raw:Record<string,unknown>)=>{
 const field=(key:string)=>str(raw[key],80);
 return ENT_SOURCE_BANK.filter(q=>(!field('subject')||q.subject===field('subject'))&&(!field('lang')||q.lang===field('lang'))&&(!field('source')||q.sourceId===field('source'))&&(!field('kind')||q.kind===field('kind'))&&(!field('level')||q.level===field('level'))&&(!field('search')||(q.stem+' '+q.topic).toLocaleLowerCase().includes(field('search').toLocaleLowerCase())));
};
async function statuses(user:string){const rows=await all<{item_id:string;correct:number;at:number}>('SELECT item_id,correct,at FROM ent_source_attempts WHERE user_id = ? ORDER BY at,id',user);return new Map(rows.map(r=>[r.item_id,!!r.correct]));}
entSourcesRouter.get('/meta',wrap(async(req,res)=>{requireStudent(req);res.json(ENT_SOURCE_META);}));
entSourcesRouter.get('/bank',wrap(async(req,res)=>{
 const user=requireStudent(req),history=await statuses(user.id);let pool=filtered(req.query as Record<string,unknown>);
 if(req.query.status==='new')pool=pool.filter(q=>!history.has(q.id));
 if(req.query.status==='wrong')pool=pool.filter(q=>history.get(q.id)===false);
 const page=Math.max(0,Math.floor(Number(req.query.page)||0)),size=30;
 res.json({total:pool.length,page,pages:Math.ceil(pool.length/size),items:pool.slice(page*size,(page+1)*size).map(q=>({id:q.id,subject:q.subject,topic:q.topic,lang:q.lang,kind:q.kind,sourceId:q.sourceId,review:q.review,level:q.level,stem:q.stem,status:history.has(q.id)?history.get(q.id)?'correct':'wrong':'new'}))});
}));
entSourcesRouter.get('/question/:id',wrap(async(req,res)=>{requireStudent(req);res.json({question:sourcePublic(must(ENT_SOURCE_BY_ID.get(str(req.params.id,70)),404,'Задание не найдено'))});}));
entSourcesRouter.post('/practice',wrap(async(req,res)=>{
 const user=requireStudent(req),history=await statuses(user.id);let pool=filtered(req.body??{});
 if(req.body?.status==='wrong')pool=pool.filter(q=>history.get(q.id)===false);
 if(req.body?.status==='new')pool=pool.filter(q=>!history.has(q.id));
 const candidates=pool.map(q=>({q,tie:Math.random()})).sort((a,b)=>Number(history.has(a.q.id))-Number(history.has(b.q.id))||a.tie-b.tie);
 const items:EntSourceQuestion[]=[];const conditions=new Set<string>();
 for(const {q}of candidates){if(conditions.has(q.conditionId))continue;conditions.add(q.conditionId);items.push(q);if(items.length===10)break;}
 const review=items.some(q=>history.has(q.id));res.json({total:pool.length,items:items.map(sourcePublic),review,message:!items.length?'По выбранным фильтрам заданий нет. Измените язык, источник или статус.':review?'В набор включены задания для повторения.':''});
}));
entSourcesRouter.post('/check',wrap(async(req,res)=>{
 const user=requireStudent(req),q=must(ENT_SOURCE_BY_ID.get(str(req.body?.id,70)),404,'Задание не найдено');
 const given=req.body?.answer,correct=sourceCorrect(q,given);
 await run('INSERT INTO ent_source_attempts (user_id,item_id,correct,given,at) VALUES (?,?,?,?,?)',user.id,q.id,correct?1:0,JSON.stringify(given??null).slice(0,500),Date.now());
 await addXp(user.id,correct?2:0,'ent-open-source');
 res.json({correct,answer:q.kind==='choice'?q.answer:q.accepted,answerLabel:q.kind==='choice'?q.options![q.answer!]:q.accepted!.join(' / '),explanation:q.explanation,evidence:q.evidence,evidenceUrl:q.evidenceUrl,review:q.review});
}));
