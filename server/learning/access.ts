import type { Request } from 'express';
import { requireStudent } from '../auth';
import { HttpError } from '../http';
import { getCatalogue, getLearningProfile } from './profile';
export async function requireLearningModule(req:Request,moduleId:string,expectedVersion?:unknown){
 const user=requireStudent(req),profile=await getLearningProfile(user.id),catalog=await getCatalogue();
 if(!profile.directionId)throw new HttpError(409,'Сначала выберите направление обучения');
 if(expectedVersion!==undefined&&expectedVersion!==profile.version)throw new HttpError(409,'Профиль изменился. Обновите учебный маршрут');
 const direction=catalog.find(d=>d.id===profile.directionId),module=direction?.modules.find(m=>m.id===moduleId);
 if(!direction||!module)throw new HttpError(403,'Этот модуль относится к другому профилю обучения');
 return {user,profile,direction,module};
}
