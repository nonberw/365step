import { Router } from 'express';
import { requireStudent } from '../auth';
import { db,id,one,all } from '../db';
import { HttpError,wrap } from '../http';
import { getLessonContent,getModuleContent,publicLesson } from './content';
import { requireLearningModule } from './access';
import { assessPractice } from './assessment';
import { getLearningProfile,getCatalogue } from './profile';
import type { PracticeItem,PracticeFeedback } from '../../shared/learningContent';
interface Attempt {id:string;user_id:string;direction_id:string;module_id:string;lesson_id:string;items:string;answers:string;done_at:number|null;xp:number;request_key:string}
interface SavedAnswer {given:string;feedback:PracticeFeedback;at:number}
export const practiceRouter=Router();
practiceRouter.get('/modules/:id',wrap(async(req,res)=>{const hit=await requireLearningModule(req,String(req.params.id));const content=await getModuleContent(hit.module.id);const progress=await all<{lesson_id:string}>('SELECT DISTINCT lesson_id FROM learning_attempts WHERE user_id=? AND module_id=? AND done_at IS NOT NULL',hit.user.id,hit.module.id);res.json({...content,lessons:content.lessons.map(({items,...l})=>({...l,itemCount:items.length})),sources:hit.direction.sources,completed:progress.map(p=>p.lesson_id)});}));
practiceRouter.get('/lessons/:id',wrap(async(req,res)=>{const {module,lesson}=await getLessonContent(String(req.params.id));await requireLearningModule(req,module.id);res.json(publicLesson(lesson));}));
practiceRouter.post('/attempts',wrap(async(req,res)=>{
 const {lessonId,profileVersion,idempotencyKey}=req.body??{};
 if(typeof lessonId!=='string'||typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>100)throw new HttpError(400,'Проверьте параметры учебной попытки');
 const {module,lesson}=await getLessonContent(lessonId);const {user,profile}=await requireLearningModule(req,module.id,profileVersion);
 const existing=await one<Attempt>('SELECT * FROM learning_attempts WHERE user_id=? AND request_key=?',user.id,idempotencyKey);
 if(existing){if(existing.lesson_id!==lessonId)throw new HttpError(409,'Ключ запроса уже используется другим уроком');return res.json({attemptId:existing.id,lesson:publicLesson(lesson),answers:JSON.parse(existing.answers),done:!!existing.done_at,xp:existing.xp});}
 const attemptId=id();
 await db.execute({sql:'INSERT OR IGNORE INTO learning_attempts(id,user_id,direction_id,module_id,lesson_id,content_version,items,created_at,request_key) VALUES(?,?,?,?,?,?,?,?,?)',args:[attemptId,user.id,profile.directionId!,module.id,lesson.id,lesson.version,JSON.stringify(lesson.items),Date.now(),idempotencyKey]});
 const stored=await one<Attempt>('SELECT * FROM learning_attempts WHERE user_id=? AND request_key=?',user.id,idempotencyKey);
 if(!stored||stored.lesson_id!==lessonId)throw new HttpError(409,'Ключ запроса уже используется другим уроком');
 res.status(stored.id===attemptId?201:200).json({attemptId:stored.id,lesson:publicLesson(lesson),answers:JSON.parse(stored.answers),done:!!stored.done_at,xp:stored.xp});
}));
async function ownAttempt(userId:string,attemptId:string){const row=await one<Attempt>('SELECT * FROM learning_attempts WHERE id=? AND user_id=?',attemptId,userId);if(!row)throw new HttpError(404,'Учебная попытка не найдена');return row;}
practiceRouter.get('/attempts/:id',wrap(async(req,res)=>{const row=await ownAttempt(requireStudent(req).id,String(req.params.id));res.json({attemptId:row.id,lessonId:row.lesson_id,items:(JSON.parse(row.items) as PracticeItem[]).map(({answer:_a,explanation:_e,...q})=>q),answers:JSON.parse(row.answers),done:!!row.done_at,xp:row.xp});}));
practiceRouter.post('/attempts/:id/answers',wrap(async(req,res)=>{
 const user=requireStudent(req),row=await ownAttempt(user.id,String(req.params.id));if(row.done_at)throw new HttpError(409,'Попытка уже завершена');
 const items=JSON.parse(row.items) as PracticeItem[],item=items.find(q=>q.id===req.body?.itemId);if(!item)throw new HttpError(400,'Такого задания нет в попытке');
 const given=typeof req.body?.answer==='string'?req.body.answer.trim():typeof req.body?.answer==='number'?String(req.body.answer):'';
 if(!given||given.length>20000)throw new HttpError(400,'Ответ должен содержать от 1 до 20 000 символов');
 if(item.kind==='rubric'&&given.split(/\s+/).length<(item.minWords??25))throw new HttpError(400,`Раскрой рассуждение: нужно не менее ${item.minWords??25} слов`);
 const feedback=assessPractice(item,given),tx=await db.transaction('write');
 try{const latest=(await tx.execute({sql:'SELECT answers,done_at FROM learning_attempts WHERE id=? AND user_id=?',args:[row.id,user.id]})).rows[0]!;if(latest.done_at)throw new HttpError(409,'Попытка уже завершена');const answers=JSON.parse(String(latest.answers)) as Record<string,SavedAnswer>;
 if(answers[item.id]){await tx.commit();return res.json(answers[item.id]!.feedback);}
 answers[item.id]={given,feedback,at:Date.now()};await tx.execute({sql:'UPDATE learning_attempts SET answers=? WHERE id=?',args:[JSON.stringify(answers),row.id]});
 if(feedback.correct===false)await tx.execute({sql:'INSERT INTO learning_reviews(user_id,item_id,direction_id,due_at,correct_streak) VALUES(?,?,?,?,0) ON CONFLICT(user_id,item_id) DO UPDATE SET due_at=excluded.due_at,correct_streak=0',args:[user.id,item.id,row.direction_id,Date.now()]});
 if(feedback.correct===true)await tx.execute({sql:'UPDATE learning_reviews SET due_at=?,correct_streak=correct_streak+1 WHERE user_id=? AND item_id=?',args:[Date.now()+86400000*3,user.id,item.id]});
 await tx.commit();res.json(feedback);}catch(e){await tx.rollback().catch(()=>{});throw e;}finally{tx.close();}
}));
practiceRouter.post('/attempts/:id/finish',wrap(async(req,res)=>{
 const user=requireStudent(req),tx=await db.transaction('write');
 try{const r=(await tx.execute({sql:'SELECT * FROM learning_attempts WHERE id=? AND user_id=?',args:[String(req.params.id),user.id]})).rows[0];if(!r)throw new HttpError(404,'Попытка не найдена');
 if(r.done_at){await tx.commit();return res.json({done:true,xp:Number(r.xp),alreadyCompleted:true});}
 const items=JSON.parse(String(r.items)) as PracticeItem[],answers=JSON.parse(String(r.answers)) as Record<string,SavedAnswer>;
 if(items.some(q=>!answers[q.id]))throw new HttpError(400,'Сначала отправьте ответы на все задания');
 const prior=(await tx.execute({sql:'SELECT id FROM learning_attempts WHERE user_id=? AND lesson_id=? AND done_at IS NOT NULL LIMIT 1',args:[user.id,String(r.lesson_id)]})).rows.length>0;
 const xp=prior?0:10+Object.values(answers).filter(a=>a.feedback.correct===true).length*2,at=Date.now();
 await tx.execute({sql:'UPDATE learning_attempts SET done_at=?,xp=? WHERE id=?',args:[at,xp,String(r.id)]});
 if(xp)await tx.execute({sql:'INSERT INTO xp_log(user_id,amount,reason,at) VALUES(?,?,?,?)',args:[user.id,xp,`learning:${String(r.lesson_id)}`,at]});
 await tx.commit();res.json({done:true,xp,objectiveCorrect:Object.values(answers).filter(a=>a.feedback.correct===true).length,rubricSubmitted:Object.values(answers).filter(a=>a.feedback.correct===null).length});
 }catch(e){await tx.rollback().catch(()=>{});throw e;}finally{tx.close();}
}));
practiceRouter.get('/projects/:id',wrap(async(req,res)=>{const user=requireStudent(req),projectId=String(req.params.id),moduleId=projectId.replace(/-project$/,'');const content=await getModuleContent(moduleId);if(content.project.id!==projectId)throw new HttpError(404,'Проект не найден');
 const saved=await one('SELECT body,version,submitted_at,updated_at FROM learning_projects WHERE user_id=? AND project_id=?',user.id,projectId);
 if(!saved)await requireLearningModule(req,moduleId);const review=saved?await one('SELECT scores,comment,at FROM learning_project_reviews WHERE user_id=? AND project_id=? AND version=?',user.id,projectId,saved.version):null;res.json({...content.project,review:review?{...review,scores:JSON.parse(String(review.scores))}:null,draft:saved??{body:'',version:0,submitted_at:null},archived:(await getLearningProfile(user.id)).directionId!==content.directionId});
}));
practiceRouter.put('/projects/:id/draft',wrap(async(req,res)=>{
 const projectId=String(req.params.id),content=await getModuleContent(projectId.replace(/-project$/,''));if(content.project.id!==projectId)throw new HttpError(404,'Проект не найден');
 const {user,profile}=await requireLearningModule(req,content.id,req.body?.profileVersion),body=req.body?.body,version=req.body?.draftVersion;
 if(typeof body!=='string'||body.length>100000||!Number.isInteger(version)||version<0)throw new HttpError(400,'Проверьте черновик и его версию');
 const tx=await db.transaction('write');try{const old=(await tx.execute({sql:'SELECT version FROM learning_projects WHERE user_id=? AND project_id=?',args:[user.id,projectId]})).rows[0];if(Number(old?.version??0)!==version)throw new HttpError(409,'Черновик изменён в другой вкладке. Скопируйте свой текст и обновите страницу');
 const at=Date.now();await tx.execute({sql:'INSERT INTO learning_projects(user_id,project_id,direction_id,body,version,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,project_id) DO UPDATE SET body=excluded.body,version=excluded.version,updated_at=excluded.updated_at,submitted_at=NULL',args:[user.id,projectId,profile.directionId!,body,version+1,at]});await tx.commit();res.json({version:version+1,savedAt:at});}catch(e){await tx.rollback().catch(()=>{});throw e;}finally{tx.close();}
}));
practiceRouter.post('/projects/:id/submit',wrap(async(req,res)=>{const user=requireStudent(req),row=await one<{body:string;version:number}>('SELECT body,version FROM learning_projects WHERE user_id=? AND project_id=?',user.id,String(req.params.id));if(!row)throw new HttpError(400,'Сначала сохраните черновик');if(req.body?.draftVersion!==row.version)throw new HttpError(409,'Сначала сохраните актуальную версию');if(row.body.trim().split(/\s+/).length<120)throw new HttpError(400,'Для итоговой работы нужно не менее 120 слов: данные, метод, результат и ограничения');const submitted=await db.execute({sql:'UPDATE learning_projects SET submitted_at=? WHERE user_id=? AND project_id=? AND version=?',args:[Date.now(),user.id,String(req.params.id),row.version]});if(!submitted.rowsAffected)throw new HttpError(409,'Черновик изменился. Сохраните актуальную версию');res.json({submitted:true,status:'awaiting-review',message:'Работа сохранена в портфолио. Проверка по рубрике ещё не выполнена.'});}));
practiceRouter.get('/archive',wrap(async(req,res)=>{const u=requireStudent(req);res.json({attempts:await all('SELECT id,direction_id,module_id,lesson_id,done_at,xp FROM learning_attempts WHERE user_id=? AND done_at IS NOT NULL ORDER BY done_at DESC',u.id),projects:await all('SELECT project_id,direction_id,version,submitted_at,updated_at FROM learning_projects WHERE user_id=? ORDER BY updated_at DESC',u.id)});}));
practiceRouter.get('/review',wrap(async(req,res)=>{const u=requireStudent(req),profile=await getLearningProfile(u.id);const rows=await all<{item_id:string;due_at:number}>('SELECT item_id,due_at FROM learning_reviews WHERE user_id=? AND direction_id=? AND correct_streak<3 AND due_at<=? ORDER BY due_at LIMIT 30',u.id,profile.directionId,Date.now());res.json(rows.map(r=>({id:r.item_id,to:`/learn/lesson/${r.item_id.replace(/-l(\d)-.*$/,'-lesson-$1')}`,dueAt:r.due_at})));}));
practiceRouter.get('/search',wrap(async(req,res)=>{const user=requireStudent(req),profile=await getLearningProfile(user.id),d=(await getCatalogue()).find(x=>x.id===profile.directionId);const q=String(req.query.q??'').trim().toLowerCase().slice(0,100);const results=(d?await Promise.all(d.modules.map(async m=>{const c=await getModuleContent(m.id);return [{id:m.id,title:m.title,to:`/learn/module/${m.id}`,kind:'module'},...c.lessons.map(l=>({id:l.id,title:`${m.title}: ${l.title}`,to:`/learn/lesson/${l.id}`,kind:'lesson'}))];})):[]).flat().filter(x=>!q||x.title.toLowerCase().includes(q));res.json(results);}));
