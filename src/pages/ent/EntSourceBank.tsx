import {useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Check,RotateCcw} from 'lucide-react';
import type {EntSourceMeta,EntSourcePublic} from '@shared/entSources';
import {ENT_SUBJECTS} from '@shared/ent';
import {api} from '@/api';
import {useApi} from '@/hooks/useApi';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Select} from '@/components/ui/input';
import {RichText} from '@/components/RichText';
import {ErrorBox,Loading} from '@/components/Page';
import {cn} from '@/lib/utils';
type BankRow={id:string;subject:string;topic:string;lang:string;kind:string;sourceId:string;review:string;level?:string;stem:string;status:string};
type Result={correct:boolean;answer:number|string[];answerLabel:string;explanation:string;evidence?:string;evidenceUrl?:string;review:string};
const LANG:Record<string,string>={ru:'Русский',kk:'Қазақша',en:'English'};
const name=(id:string)=>ENT_SUBJECTS.find(s=>s.id===id)?.name??id;
export default function EntSourceBank(){
 const [params]=useSearchParams();const meta=useApi<EntSourceMeta>('/ent/sources/meta');
 const [subject,setSubject]=useState(params.get('subject')??''),[lang,setLang]=useState(params.get('lang')??'');
 const [source,setSource]=useState(''),[kind,setKind]=useState(''),[status,setStatus]=useState(''),[level,setLevel]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(0);
 const [items,setItems]=useState<EntSourcePublic[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [revision,setRevision]=useState(0);
 const filters={subject,lang,source,kind,status,level,search};const query=new URLSearchParams({...filters,page:String(page)});
 const bank=useApi<{total:number;page:number;pages:number;items:BankRow[]}>(`/ent/sources/bank?${query}&refresh=${revision}`);
 const back=()=>{setItems(null);setRevision(r=>r+1);setPage(0);};
 async function start(id?:string){setBusy(true);setError('');try{if(id){const r=await api<{question:EntSourcePublic}>(`/ent/sources/question/${id}`);setItems([r.question]);setNotice('');}else{const r=await api<{items:EntSourcePublic[];message:string}>('/ent/sources/practice',{body:filters});setNotice(r.message);setItems(r.items.length?r.items:null);}setRevision(r=>r+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const update=(fn:(v:string)=>void)=>(e:React.ChangeEvent<HTMLSelectElement|HTMLInputElement>)=>{fn(e.target.value);setPage(0);};
 if(meta.loading)return <Loading/>;if(!meta.data)return <ErrorBox message={meta.error}/>;
 const data=meta.data;
 return <div className="flex max-w-6xl flex-col gap-5">
  <Link to="/ent" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>Подготовка к ЕНТ</Link>
  <header className="rounded-3xl bg-gradient-to-br from-[#2f69cf] to-[#6a9be3] p-6 text-white sm:p-8">
   <p className="text-xs font-semibold uppercase tracking-widest text-[#ffdd71]">Большой открытый банк</p>
   <h1 className="mt-2 font-display text-3xl font-bold">Больше практики по ЕНТ</h1>
   <p className="mt-3 max-w-3xl text-sm leading-6">{data.total.toLocaleString('ru')} записей · {data.conditions.toLocaleString('ru')} вопросов по учёту источников, без повторного подсчёта переводов. Вопросы из опубликованных учебных и исследовательских наборов. У каждого задания указан источник.</p>
  </header>
  {items?<><p role="status" className="text-sm text-muted-foreground">{notice}</p><SourceRun key={revision+':'+items.map(q=>q.id).join(',')} items={items} sources={data.sources} onBack={back} onMore={()=>start()}/></>:<>
   <Card className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     <label className="text-sm">Предмет<Select aria-label="Предмет" value={subject} onChange={update(setSubject)}><option value="">Все доступные предметы</option>{ENT_SUBJECTS.filter(s=>data.subjects[s.id]).map(s=><option key={s.id} value={s.id}>{s.name} · {data.subjects[s.id]} на всех языках</option>)}</Select></label>
     <label className="text-sm">Язык<Select aria-label="Язык заданий" value={lang} onChange={update(setLang)}><option value="">Все языки</option>{Object.entries(data.languages).map(([id,n])=><option key={id} value={id}>{LANG[id]} · {n}</option>)}</Select></label>
     <label className="text-sm">Источник<Select aria-label="Источник" value={source} onChange={update(setSource)}><option value="">Все источники</option>{data.sources.map(s=><option key={s.id} value={s.id}>{s.title} · {data.sourceCounts[s.id]}</option>)}</Select></label>
     <label className="text-sm">Формат<Select aria-label="Формат задания" value={kind} onChange={update(setKind)}><option value="">Все форматы</option><option value="choice">С вариантами ответа</option><option value="short">Ввод ответа</option></Select></label>
     <label className="text-sm">Мой прогресс<Select aria-label="Мой прогресс" value={status} onChange={update(setStatus)}><option value="">Все, затем повторение</option><option value="new">Ещё не решал</option><option value="wrong">Последний ответ — ошибка</option></Select></label>
     <label className="text-sm">Сложность<Select aria-label="Сложность источника" value={level} onChange={update(setLevel)}><option value="">Все, включая неоценённые</option><option value="C">C — OpenStax, редакционная оценка</option><option value="B">B — OpenStax, редакционная оценка</option></Select></label>
    </div>
    <label className="text-sm">Поиск по условию<input aria-label="Поиск по условию" className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3" value={search} onChange={update(setSearch)} placeholder="Например: генетика, температура, ханды"/></label>
    <div className="flex flex-wrap items-center gap-3"><Button disabled={busy||!bank.data?.total} onClick={()=>start()}>{busy?'Подбираю…':'Тренировка: до 10 заданий'}<ArrowRight className="size-4"/></Button><span className="text-sm text-muted-foreground">Найдено: {bank.data?.total.toLocaleString('ru')??'…'}</span></div>
    <p className="text-xs leading-5 text-muted-foreground">Числа в списках относятся ко всему источнику или предмету; «Найдено» учитывает все фильтры. Большинство источников не размечает сложность B/C. Ключ источника и независимая проверка отмечены отдельно. Это дополнительная практика; полный пробник в формате ЕНТ доступен в основном разделе.</p>
    {notice&&<p role="status" className="text-sm">{notice}</p>}<ErrorBox message={error||bank.error}/>
   </Card>
   {bank.loading?<Loading/>:bank.data?.items.length?<div className="grid gap-3 sm:grid-cols-2">{bank.data.items.map(q=><button key={q.id} disabled={busy} onClick={()=>start(q.id)} className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary">
    <span className="text-xs font-medium text-primary">{name(q.subject)} · {LANG[q.lang]} · {q.kind==='choice'?'Выбор ответа':'Ввод ответа'}</span>
    <div className="mt-2 line-clamp-3 text-sm leading-6"><Content text={q.stem}/></div><span className="mt-2 block text-xs text-muted-foreground">{q.sourceId} · {q.level?`уровень ${q.level}`:'сложность не размечена'} · {q.status==='new'?'новое':q.status==='correct'?'решено верно':'повторить ошибку'}</span>
   </button>)}</div>:<p className="rounded-2xl bg-muted p-5 text-sm">По этим фильтрам заданий нет. Например, KazQAD и казахская часть INCLUDE доступны на казахском; Belebele — на трёх языках.</p>}
   {!!bank.data?.pages&&<div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page===0} onClick={()=>setPage(page-1)}>Назад</Button><span className="text-sm">{page+1} / {bank.data.pages}</span><Button variant="outline" disabled={page+1>=bank.data.pages} onClick={()=>setPage(page+1)}>Дальше</Button></div>}
   <details className="rounded-2xl border border-border p-4 text-sm"><summary className="cursor-pointer font-semibold">Источники, лицензии и границы проверки</summary><div className="mt-4 flex flex-col gap-4">{data.sources.map(s=><div key={s.id}><a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-primary underline">{s.title}</a><p className="mt-1 text-xs">{s.authors} · <a href={s.licenseUrl} target="_blank" rel="noreferrer" className="underline">{s.license}</a></p><p className="mt-1 text-sm text-muted-foreground">{s.notice}</p></div>)}</div></details>
   <a href="/content/ent-source-bank-2026.json.gz" download className="text-sm text-primary underline">Скачать вопросы с ключами, атрибуцией и лицензиями · JSON.gz</a>
  </>}
 </div>;
}
function Content({text:body}:{text:string}){return <>{body.split(/```[^\n]*\n([\s\S]*?)```/g).map((part,i)=>i%2?<pre key={i} className="overflow-auto rounded-xl bg-muted p-4 text-sm"><code>{part}</code></pre>:<RichText key={i} text={part}/>)}</>;}
function SourceRun({items,sources,onBack,onMore}:{items:EntSourcePublic[];sources:EntSourceMeta['sources'];onBack:()=>void;onMore:()=>void}){
 const [index,setIndex]=useState(0),[responses,setResponses]=useState<Record<string,string|number>>({}),[results,setResults]=useState<Record<string,Result>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const q=items[index];if(!q)return <Card className="flex flex-col items-center gap-4 py-10"><h2 className="font-display text-2xl font-semibold">Набор пройден</h2><p>{Object.values(results).filter(r=>r.correct).length} верно из {items.length}</p><div className="flex gap-3"><Button onClick={onMore}><RotateCcw/>Ещё задания</Button><Button variant="outline" onClick={onBack}>Вернуться в банк</Button></div></Card>;
 const result=results[q.id],given=responses[q.id],source=sources.find(s=>s.id===q.sourceId)!;
 async function check(){setBusy(true);setError('');try{const r=await api<Result>('/ent/sources/check',{body:{id:q.id,answer:given}});setResults(prev=>({...prev,[q.id]:r}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="flex flex-col gap-4"><button onClick={onBack} className="self-start text-sm text-muted-foreground">← К фильтрам и списку</button><div className={cn('grid gap-4',q.passage&&'lg:grid-cols-2')}>
  {q.passage&&<Card className="self-start"><p className="mb-3 text-xs font-semibold uppercase text-primary">Текст к вопросу</p><Content text={q.passage}/></Card>}
  <Card className="flex flex-col gap-4">
   <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{index+1} / {items.length} · {name(q.subject)} · {LANG[q.lang]}</span><span>{q.level?`Сложность ${q.level}`:'Сложность источником не размечена'}</span></div>
   <div className="text-lg"><Content text={q.stem}/></div>
   {q.kind==='choice'?<div className="flex flex-col gap-2">{q.options!.map((option,i)=><button key={i} disabled={!!result} onClick={()=>setResponses({...responses,[q.id]:i})} className={cn('flex items-start gap-3 rounded-xl border-2 p-3 text-left text-sm',given===i?'border-primary bg-primary/5':'border-border',result?.answer===i&&'border-success bg-success/10')}><span className="font-bold">{String.fromCharCode(65+i)}</span><Content text={option}/></button>)}</div>:<label className="text-sm font-medium">Твой ответ<input aria-label="Твой ответ" disabled={!!result} value={given??''} onChange={e=>setResponses({...responses,[q.id]:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!result&&!busy&&given!==undefined&&String(given).trim())check();}} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base" placeholder={q.responseRule==='number-set'?'Номера через запятую, например 1,3':q.responseRule==='numeric'?'Можно записать точную дробь, например 5/2':'Запиши слово, имя, дату или термин'}/><span className="mt-1 block text-xs font-normal text-muted-foreground">{q.sourceId==='kazqad'?'Используй точное название на казахском языке. После проверки появится подтверждающий отрывок.':'Ответ проверяется по опубликованному ключу.'}</span></label>}
   <details className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Источник и проверка</summary><a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-primary underline">{source.title}</a><p className="mt-1">{source.authors} · <a href={source.licenseUrl} className="underline" target="_blank" rel="noreferrer">{source.license}</a></p><p className="mt-1">{q.sourceRef}</p><p className="mt-1">{q.review==='independent-math-verified'?'Ответ независимо пересчитан.':q.review==='source-span-checked'?'Ответ источника проверен на наличие в подтверждающем отрывке.':'Использован ключ составителей; независимого решения для каждого задания пока нет.'}</p></details>
   {result&&<div className={cn('rounded-xl p-4 text-sm',result.correct?'bg-success/10':'bg-primary/10')}><p className="mb-2 flex items-center gap-2 font-semibold">{result.correct&&<Check className="size-4"/>}{result.correct?'Верно':'Ответ не совпал с ключом'}</p><p className="mb-2 font-medium">Ответ источника:</p><Content text={result.answerLabel}/><div className="mt-3 text-muted-foreground"><Content text={result.explanation}/></div>{result.evidence&&<blockquote className="mt-3 border-l-2 border-primary pl-3"><Content text={result.evidence}/></blockquote>}{result.evidenceUrl&&<a className="mt-2 inline-block text-primary underline" href={result.evidenceUrl} target="_blank" rel="noreferrer">Посмотреть исходный материал</a>}</div>}
   <ErrorBox message={error}/>{!result?<Button disabled={busy||given===undefined||String(given).trim()===''} onClick={check}>{busy?'Проверяю…':'Проверить ответ'}</Button>:<Button onClick={()=>{setIndex(index+1);setError('');}}>Дальше<ArrowRight className="size-4"/></Button>}
  </Card>
 </div></div>;
}
