import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectionPicker from '@/components/DirectionPicker';
import { useLearning } from '@/lib/learning';
import { ErrorBox } from '@/components/Page';
export default function ProfileSwitch(){
 const {data,switchProfile}=useLearning(),navigate=useNavigate();const [selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const current=data?.direction,chosen=data?.catalog.find(d=>d.id===selected);
 return <section id="learning" className="rounded-3xl border p-5"><h2 className="font-display text-xl font-bold">Профиль обучения</h2><p className="mt-2">{current?`${current.emoji} ${current.title}`:'Направление ещё не выбрано'}</p><details className="mt-4"><summary className="cursor-pointer text-sm text-muted-foreground">Дополнительные параметры</summary><details className="mt-4"><summary className="cursor-pointer font-semibold text-primary">Сменить профиль обучения</summary><p className="my-4 text-sm text-muted-foreground">Меню и учебный план перестроятся. Работы, прогресс, XP и результаты экзаменов сохранятся. При возвращении ты продолжишь с прежнего места.</p><DirectionPicker catalog={data?.catalog} value={selected} onChange={setSelected}/>{chosen&&<div className="my-4 rounded-xl bg-muted p-4"><b>Новый профиль: {chosen.title}</b><p className="mt-2 text-sm">{chosen.modules.map(m=>m.title).join(' · ')}</p></div>}<ErrorBox message={error}/><button disabled={!selected||selected===current?.id||busy} className="mt-4 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-40" onClick={async()=>{if(!selected)return;setBusy(true);setError('');try{await switchProfile(selected);navigate('/learn');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Сохраняем…':'Подтвердить смену профиля'}</button></details></details></section>;
}
