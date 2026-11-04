import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { DIRECTIONS, type Direction } from '@shared/directions';
export default function DirectionPicker({catalog=DIRECTIONS,value,onChange}:{catalog?:Direction[];value:string|null;onChange:(id:string)=>void}){
 const [query,setQuery]=useState('');
 const matches=useMemo(()=>catalog.filter(d=>[d.title,...Object.values(d.titles),d.aliases,d.description,...d.modules.map(m=>m.title)].join(' ').toLowerCase().replace(/ё/g,'е').includes(query.toLowerCase().replace(/ё/g,'е'))),[catalog,query]);
 return <div className="flex flex-col gap-5">
  <label className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-slate-600"><Search className="size-5"/><input className="w-full bg-transparent text-sm outline-none" aria-label="Найти направление или специальность" placeholder="Например: врач, предприниматель, пилот…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <p className="text-sm text-slate-500" role="status">{matches.length} из {catalog.length} направлений · можно выбрать только одно</p>
  <div role="radiogroup" aria-label="Основное направление обучения" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {matches.map((d,index)=><button key={d.id} type="button" role="radio" aria-checked={value===d.id} tabIndex={value===d.id||(!matches.some(x=>x.id===value)&&index===0)?0:-1} onKeyDown={e=>{if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?matches.length-1:(index+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+matches.length)%matches.length;onChange(matches[next]!.id);const group=e.currentTarget.parentElement;setTimeout(()=>group?.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus(),0);}} onClick={()=>onChange(d.id)} className={`relative flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${value===d.id?'border-blue-500 bg-blue-50 text-slate-900':'border-slate-200 bg-white text-slate-800 hover:border-blue-300'}`}>
    <div className="flex w-full items-center justify-between"><span className="text-3xl" aria-hidden>{d.emoji}</span>{value===d.id&&<Check className="size-5 text-blue-600"/>}</div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{d.group}</span><span className="font-display text-lg font-bold leading-snug">{d.title}</span><span className="text-xs leading-relaxed text-slate-500">{d.description}</span>
    <span className="mt-auto border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">{d.modules.map(m=>m.title).join(' · ')}</span>
   </button>)}
  </div>{!matches.length&&<p className="rounded-2xl bg-slate-50 p-6 text-slate-600">Попробуй другое название профессии или очисти поиск.</p>}
 </div>;
}
