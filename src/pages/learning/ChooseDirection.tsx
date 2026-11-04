import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectionPicker from '@/components/DirectionPicker';
import { useLearning } from '@/lib/learning';
import { ErrorBox, Loading } from '@/components/Page';
export default function ChooseDirection({embedded=false}:{embedded?:boolean}){
 const {data,loading,error,switchProfile}=useLearning(),navigate=useNavigate();
 const [selected,setSelected]=useState<string|null>(null),[specialty,setSpecialty]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const chosen=data?.catalog.find(d=>d.id===selected);
 if(loading)return <Loading/>;
 return <div className={embedded?"text-foreground":"min-h-dvh bg-[#f4f7fc] px-4 py-10 text-slate-900"}><div className="mx-auto max-w-6xl"><p className="text-sm font-bold text-blue-600">365step · твой учебный профиль</p><h1 className="mt-3 font-display text-4xl font-bold">К какому будущему готовимся?</h1><p className="mb-8 mt-3 max-w-2xl text-slate-500">Дополнительные занятия по интересующему направлению. Выбор необязателен: подготовка к ЕНТ, SAT и IELTS доступна отдельно и остаётся основой платформы.</p><ErrorBox message={message||error}/><DirectionPicker catalog={data?.catalog} value={selected} onChange={id=>{setSelected(id);setSpecialty('');}}/>
 {chosen&&<section className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-slate-200"><h2 className="font-display text-xl font-bold">{chosen.emoji} {chosen.title}</h2><p className="my-3 text-sm text-slate-500">Уточни интерес — необязательно</p><select aria-label="Специальность" className="w-full rounded-xl border p-3" value={specialty} onChange={e=>setSpecialty(e.target.value)}><option value="">Пока изучаю всё направление</option>{chosen.specialties.map(s=><option key={s}>{s}</option>)}</select><p className="mt-4 text-sm text-slate-500">В кабинете появятся: {chosen.modules.map(m=>m.title).join(' · ')}</p></section>}
 <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur"><span className="text-sm text-slate-500">{chosen?chosen.title:'Сначала выбери направление'}</span><button disabled={!selected||busy} className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:bg-slate-300" onClick={async()=>{if(!selected)return;setBusy(true);setMessage('');try{await switchProfile(selected,specialty||null);navigate('/directions',{replace:true});}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}}>{busy?'Сохраняем…':'Открыть направление'}</button></div></div></div>;
}
