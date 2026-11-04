import { Link } from 'react-router-dom';
import { useLearning } from '@/lib/learning';
import { ErrorBox,Loading } from '@/components/Page';
import DirectionHome from './DirectionHome';
import ChooseDirection from './ChooseDirection';
export default function Directions(){
 const {data,loading,error}=useLearning();
 if(loading)return <Loading/>;
 if(error)return <ErrorBox message={error}/>;
 return <div className="flex flex-col gap-6"><header className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-xl font-bold">Дополнительное направление</p><p className="mt-2 text-sm text-muted-foreground">Проекты и занятия по интересам. Подготовка к ЕНТ, SAT и IELTS всегда доступна в основном меню.</p></div>{data?.direction&&<Link className="rounded-xl border px-4 py-2 text-sm font-semibold text-primary" to="/choose-direction">Выбрать другое направление</Link>}</header>{data?.direction?<DirectionHome/>:<ChooseDirection embedded/>}</div>;
}
