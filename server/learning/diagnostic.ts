import { Router } from 'express';
import { requireStudent } from '../auth';
import { one,run } from '../db';
import { wrap,HttpError } from '../http';
import { getLearningProfile,getCatalogue } from './profile';
import { getModuleContent } from './content';
import { assessPractice } from './assessment';
export const diagnosticRouter=Router();
async function context(userId:string){const profile=await getLearningProfile(userId),direction=(await getCatalogue()).find(d=>d.id===profile.directionId);if(!direction)throw new HttpError(400,'Сначала выберите направление');const modules=await Promise.all(direction.modules.slice(0,3).map(m=>getModuleContent(m.id)));return {profile,direction,items:modules.map(m=>({moduleId:m.id,title:m.title,scenario:m.lessons[0]!.blocks[0]!.text,data:m.lessons[1]!.blocks[0]!.text,item:m.lessons[1]!.items[0]!}))};}
diagnosticRouter.get('/diagnostic',wrap(async(req,res)=>{const u=requireStudent(req),c=await context(u.id),saved=await one<{result:string}>('SELECT result FROM learning_diagnostics WHERE user_id=? AND direction_id=?',u.id,c.direction.id);res.json({direction:c.direction.title,version:c.profile.version,result:saved?JSON.parse(saved.result):null,items:c.items.map(({item,...m})=>({...m,id:item.id,prompt:item.prompt}))});}));
diagnosticRouter.post('/diagnostic',wrap(async(req,res)=>{const u=requireStudent(req),c=await context(u.id);if(req.body?.profileVersion!==c.profile.version)throw new HttpError(409,'Профиль изменился. Обновите диагностику');const skipped=req.body?.skipped===true,answers=req.body?.answers;let result;
 if(skipped)result={skipped:true,recommendation:c.direction.modules[0]!.id,message:'Диагностика пропущена. Можно начать с первого модуля.'};
 else{if(!answers||typeof answers!=='object'||Array.isArray(answers)||c.items.some(m=>typeof answers[m.item.id]!=='string'||!answers[m.item.id].trim()||answers[m.item.id].length>100))throw new HttpError(400,'Ответьте на три вопроса или пропустите диагностику');const feedback=c.items.map(m=>({moduleId:m.moduleId,...assessPractice(m.item,answers[m.item.id])}));result={skipped:false,correct:feedback.filter(f=>f.correct).length,total:3,feedback,recommendation:feedback.find(f=>!f.correct)?.moduleId??c.direction.modules[0]!.id,message:'Это короткая ориентировочная проверка расчётных навыков. Она не оценивает всю готовность к направлению.'};}
 await run('INSERT INTO learning_diagnostics(user_id,direction_id,result,at) VALUES(?,?,?,?) ON CONFLICT(user_id,direction_id) DO UPDATE SET result=excluded.result,at=excluded.at',u.id,c.direction.id,JSON.stringify(result),Date.now());res.json(result);
}));
