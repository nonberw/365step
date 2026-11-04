import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useLearning } from '@/lib/learning';
import { useApi } from '@/hooks/useApi';
import { ErrorBox,Loading } from '@/components/Page';
import ExamReview from '@/pages/student/Review';
export default function FocusReview(){const {user}=useAuth(),{data}=useLearning();const result=useApi<{id:string;to:string;dueAt:number}[]>('/learning/review');return <div className="flex flex-col gap-6"><section className="rounded-3xl border p-6"><h1 className="font-display text-3xl font-bold">Повторение · {data?.direction?.title}</h1><p className="mt-3 text-sm text-muted-foreground">Расчётные задания, в которых была ошибка. Вернись к уроку и начни новую попытку после разбора.</p>{result.loading?<Loading/>:result.data?.length?<div className="mt-4 grid gap-3">{result.data.map(r=><Link key={r.id} className="rounded-xl bg-muted p-4 text-sm font-semibold" to={r.to}>{data?.direction?.modules.find(m=>r.id.startsWith(m.id))?.title??'Учебный кейс'} · повторить расчёт →</Link>)}</div>:<p className="mt-5 text-sm">Сейчас повторять нечего. Продолжай свой маршрут.</p>}<ErrorBox message={result.error}/></section>{(user?.goals.ent||user?.goals.sat)&&<ExamReview/>}</div>;}
