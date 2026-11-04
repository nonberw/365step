const savers=new Set<()=>Promise<void>>();
export function registerLearningDraft(save:()=>Promise<void>){savers.add(save);return()=>{savers.delete(save);};}
export async function flushLearningDrafts(){for(const save of savers)await save();}
