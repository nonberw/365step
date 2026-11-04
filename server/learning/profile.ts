import { DIRECTIONS, EMPTY_LEARNING_PROFILE, type Direction, type LearningProfile } from '../../shared/directions';
import { db, one } from '../db';
import { HttpError } from '../http';

export async function getCatalogue(): Promise<Direction[]> {
 const result=await db.execute('SELECT id,data,published FROM learning_catalog ORDER BY id');
 const archived=new Set(result.rows.filter(r=>!r.published).map(r=>String(r.id)));
 const overrides=new Map(result.rows.filter(r=>r.published).map(r=>[String(r.id ?? JSON.parse(String(r.data)).id),JSON.parse(String(r.data)) as Direction]));
 // Seed order is stable and meaningful; new editorial directions follow the seed.
 return [...DIRECTIONS.filter(d=>!archived.has(d.id)).map(d=>overrides.get(d.id)??d),...Array.from(overrides.values()).filter(d=>!DIRECTIONS.some(s=>s.id===d.id))];
}
export async function getLearningProfile(userId:string):Promise<LearningProfile> {
 const r=await one<{direction_id:string;specialization_id:string|null;version:number;updated_at:number}>('SELECT * FROM learning_profiles WHERE user_id=?',userId);
 return r?{directionId:r.direction_id,specializationId:r.specialization_id,version:r.version,updatedAt:r.updated_at}:{...EMPTY_LEARNING_PROFILE};
}
export async function validateSelection(directionId:unknown,specializationId:unknown=null) {
 if(typeof directionId!=='string')throw new HttpError(400,'Выберите одно направление из каталога');
 const direction=(await getCatalogue()).find(d=>d.id===directionId);
 if(!direction)throw new HttpError(400,'Такого направления нет в каталоге');
 if(specializationId!==null&&specializationId!==undefined&&(typeof specializationId!=='string'||!direction.specialties.includes(specializationId)))throw new HttpError(400,'Выберите специальность своего направления');
 return {direction,specializationId:typeof specializationId==='string'?specializationId:null};
}
export async function changeLearningProfile(userId:string,input:{directionId:unknown;specializationId?:unknown;expectedVersion:unknown}):Promise<LearningProfile> {
 const {direction,specializationId}=await validateSelection(input.directionId,input.specializationId);
 if(!Number.isInteger(input.expectedVersion)||Number(input.expectedVersion)<0)throw new HttpError(400,'Нужна актуальная версия профиля');
 const tx=await db.transaction('write');
 try {
  const existing=(await tx.execute({sql:'SELECT * FROM learning_profiles WHERE user_id=?',args:[userId]})).rows[0];
  const version=Number(existing?.version??0);
  if(version!==input.expectedVersion)throw new HttpError(409,'Профиль изменён в другой вкладке. Обновите страницу и повторите выбор');
  if(existing?.direction_id===direction.id&&(existing?.specialization_id??null)===specializationId){await tx.commit();return getLearningProfile(userId);}
  const at=Date.now();
  await tx.execute({sql:'INSERT INTO learning_profiles(user_id,direction_id,specialization_id,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET direction_id=excluded.direction_id,specialization_id=excluded.specialization_id,version=excluded.version,updated_at=excluded.updated_at',args:[userId,direction.id,specializationId,version+1,at]});
  await tx.execute({sql:'INSERT INTO learning_profile_events(user_id,previous_direction,direction_id,version,at) VALUES(?,?,?,?,?)',args:[userId,existing?.direction_id??null,direction.id,version+1,at]});
  await tx.commit();return {directionId:direction.id,specializationId,version:version+1,updatedAt:at};
 } catch(e){await tx.rollback().catch(()=>{});throw e;} finally {tx.close();}
}
