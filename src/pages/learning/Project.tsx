import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '@/hooks/useApi';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
import { registerLearningDraft } from '@/lib/learningDrafts';
import { ErrorBox, Loading } from '@/components/Page';
import type { LearningProject } from '@shared/learningContent';
interface ProjectView extends LearningProject {review?:{scores:number[];comment:string;at:number}|null;draft:{body:string;version:number;submitted_at:number|null};archived:boolean}
export default function Project(){
 const {projectId}=useParams(),{user}=useAuth(),result=useApi<ProjectView>(`/learning/projects/${projectId}`);
 const [recovery,setRecovery]=useState<string|null>(null);
 const [body,setBody]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const text=useRef(''),saved=useRef(''),version=useRef(0),queue=useRef<Promise<void>>(Promise.resolve()),view=useRef<ProjectView|null>(null),alive=useRef(true);
 const backupKey=`365step-project:${user?.id}:${projectId}`;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!result.data)return;view.current=result.data;version.current=result.data.draft.version;saved.current=result.data.draft.body;let value=saved.current;
  try{const local=JSON.parse(localStorage.getItem(backupKey)??'null');if(local&&typeof local.body==='string'){if(local.serverVersion===version.current)value=local.body;else if(local.body!==saved.current)setRecovery(local.body);}}catch{}
  text.current=value;setBody(value);setReady(true);
 },[result.data,backupKey]);
 const save=useCallback(async()=>{
  const perform=async()=>{if(!view.current||view.current.archived||text.current===saved.current)return;const snapshot=text.current;
   const next=await api<{version:number}>(`/learning/projects/${projectId}/draft`,{method:'PUT',body:{body:snapshot,draftVersion:version.current,profileVersion:user?.learningProfile.version}});
   saved.current=snapshot;version.current=next.version;
   try{localStorage.setItem(backupKey,JSON.stringify({body:text.current,serverVersion:version.current}));}catch{}
   if(alive.current)setMessage('Черновик сохранён');
  };
  queue.current=queue.current.catch(()=>{}).then(perform);await queue.current;
 },[projectId,user?.learningProfile.version,backupKey]);
 useEffect(()=>registerLearningDraft(save),[save]);
 useEffect(()=>{if(!ready)return;const timer=setTimeout(()=>void save().catch(e=>{if(alive.current)setError((e as Error).message);}),1000);return()=>clearTimeout(timer);},[body,ready,save]);
 if(result.loading)return <Loading/>;if(!result.data)return <ErrorBox message={result.error}/>;const p=result.data;
 return <div className="mx-auto flex max-w-4xl flex-col gap-6"><Link to={p.archived?'/directions':`/learn/module/${p.moduleId}`} className="text-sm font-semibold text-primary">← {p.archived?'Мои проекты':'К модулю'}</Link><h1 className="font-display text-3xl font-bold">{p.title}</h1>{p.archived&&<p className="rounded-2xl bg-muted p-4 text-sm">Архив предыдущего направления. Работа сохранена; для продолжения вернись к этому профилю в настройках.</p>}<section className="rounded-3xl border p-6"><h2 className="mb-3 font-display text-xl font-bold">Бриф</h2><p className="whitespace-pre-line text-sm leading-7">{p.brief}</p><h3 className="mb-2 mt-5 font-bold">Что передать</h3><ul className="list-disc space-y-2 pl-5 text-sm">{p.deliverables.map(x=><li key={x}>{x}</li>)}</ul></section><section className="rounded-3xl bg-muted/60 p-6"><h2 className="font-display text-xl font-bold">Рубрика проверки</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{p.rubric.map(r=><div key={r.label}><b className="text-sm">{r.label}</b><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.description}</p></div>)}</div></section>{p.review&&<section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-950"><h2 className="font-display text-xl font-bold">Проверка преподавателя · {p.review.scores.reduce((s,n)=>s+n,0)}/20</h2><p className="mt-3 whitespace-pre-line text-sm leading-7">{p.review.comment}</p><p className="mt-2 text-xs">Оценка относится к сохранённой версии работы. Изменение черновика потребует новой проверки.</p></section>}<section><label htmlFor="project-body" className="mb-3 block font-display text-xl font-bold">Твоя работа</label><textarea id="project-body" rows={18} readOnly={p.archived} className="w-full rounded-2xl border bg-background p-5 text-sm leading-7" placeholder="Постановка задачи → данные → метод → результат → проверка → ограничения → источники. Не менее 120 слов для отправки." value={body} onChange={e=>{text.current=e.target.value;setBody(e.target.value);setMessage('Есть несохранённые изменения');try{localStorage.setItem(backupKey,JSON.stringify({body:e.target.value,serverVersion:version.current}));}catch{}}}/><p className="mt-2 text-xs text-muted-foreground" role="status">{body.trim()?body.trim().split(/\s+/).length:0} слов · {message||'Черновик сохраняется автоматически'}</p></section>{recovery!==null&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950"><p className="text-sm">Найден локальный черновик другой версии. Сохранённая работа показана выше; можно восстановить свой текст для сравнения и правки.</p><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{recovery}</pre><button className="mt-3 text-sm font-bold underline" onClick={()=>{text.current=recovery;setBody(recovery);setRecovery(null);}}>Восстановить этот текст в редакторе</button></section>}<ErrorBox message={error}/>{!p.archived&&<div className="flex flex-wrap gap-3"><button disabled={busy} className="rounded-xl border px-5 py-3 text-sm font-semibold" onClick={()=>{setError('');void save().catch(e=>setError((e as Error).message));}}>Сохранить черновик</button><button disabled={busy} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" onClick={async()=>{setBusy(true);setError('');try{await save();const r=await api<{message:string}>(`/learning/projects/${projectId}/submit`,{body:{draftVersion:version.current}});setMessage(r.message);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Сохраняем…':'Отправить в портфолио'}</button></div>}<p className="text-xs text-muted-foreground">Отправка сохраняет работу. До проверки преподавателем или методистом она обозначается как ожидающая оценки.</p></div>;
}
