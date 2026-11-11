import { DIRECTIONS, type Direction, type LearningProfile } from './directions';
import type { Goals } from './types';
export interface LearningNavGroup {title?:string;items:{to:string;label:string}[]}
/** Exams and the established tools remain available regardless of an optional study direction. */
export function routeAccess(path:string,profile:LearningProfile,_goals:Goals,catalog:readonly Direction[]=DIRECTIONS):'allow'|'choose-profile'|'outside-profile' {
 const pathname=path.split('?')[0]!;
 const moduleId=pathname.match(/^\/learn\/module\/([^/]+)/)?.[1];
 const isDirectionContent=!!moduleId||/^\/learn\/(lesson|project)\//.test(pathname);
 if(!isDirectionContent)return 'allow';
 if(!profile.directionId)return 'choose-profile';
 if(moduleId&&!catalog.find(d=>d.id===profile.directionId)?.modules.some(m=>m.id===moduleId))return 'outside-profile';
 return 'allow';
}
const EXAM_NAV: LearningNavGroup[] = [
  {
    items: [
      { to: "/learn", label: "Учиться" },
      { to: "/app", label: "Сводка" },
      { to: "/admissions", label: "Поступление" },
      { to: "/library", label: "Библиотека" },
    ],
  },
  {
    title: "ЕНТ",
    items: [
      { to: "/ent", label: "Подготовка к ЕНТ" },
      { to: "/ent/master", label: "Мастер-режим (IRT)" },
      { to: "/review", label: "Повтор ошибок" },
      { to: "/duels", label: "Дуэли и лига" },
    ],
  },
  {
    title: "SAT",
    items: [
      { to: "/sat", label: "Overview & analytics" },
      { to: "/sat/learn", label: "Learn Math & R&W" },
      { to: "/sat/bank", label: "Question Banks" },
      { to: "/sat/test", label: "Practice tests" },
      { to: "/sat/drills", label: "Drills" },
      { to: "/sat/blitz", label: "Blitz" },
      { to: "/sat/vocab", label: "Vocabulary" },
      { to: "/sat/plan", label: "Study plan" },
      { to: "/sat/calculator", label: "Score calculator" },
    ],
  },
  {
    title: "IELTS",
    items: [
      { to: "/ielts", label: "Overview" },
      { to: "/ielts/speaking", label: "Speaking" },
      { to: "/ielts/writing", label: "Writing" },
      { to: "/ielts/reading", label: "Reading" },
      { to: "/ielts/listening", label: "Listening" },
      { to: "/ielts/games", label: "Games" },
    ],
  },
  {
    items: [
      { to: "/leaderboard", label: "Рейтинг" },
      { to: "/family", label: "Для родителей" },
      { to: "/pricing", label: "Тариф Pro" },
      { to: "/profile", label: "Профиль" },
      { to: "/directions", label: "Направление" },
    ],
  },
];
export function getNavigation(profile:LearningProfile,_goals:Goals,catalog:readonly Direction[]=DIRECTIONS):LearningNavGroup[]{
 const groups=EXAM_NAV.map(g=>({...g,items:g.items.map(i=>({...i}))}));
 const direction=catalog.find(d=>d.id===profile.directionId);
 if(direction){
  const items=[...direction.modules.map(m=>({to:`/learn/module/${m.id}`,label:m.title})),...direction.tools.map(t=>({...t}))];
  groups.splice(groups.length-1,0,{title:direction.title,items});
 }
 return groups;
}
/** Broad admissions opportunities mapped to the active study area; general opportunities remain shared. */
export function directionField(directionId:string|null|undefined):'it'|'stem'|'business'|'humanities'|'arts'|'general'{
 if(directionId==='it')return 'it';
 if(['business','finance','economics','marketing','hospitality'].includes(directionId??''))return 'business';
 if(['international','law','linguistics','humanities','psychology','society','education'].includes(directionId??''))return 'humanities';
 if(['design','arts'].includes(directionId??''))return 'arts';
 return directionId?'stem':'general';
}
