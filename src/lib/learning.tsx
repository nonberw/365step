import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from './auth';
import { useApi } from '@/hooks/useApi';
import { flushLearningDrafts } from './learningDrafts';
import { api } from '@/api';
import type { Direction, LearningProfile } from '@shared/directions';
import type { Goals } from '@shared/types';
import type { LearningNavGroup } from '@shared/directionPolicy';
export interface LearningBootstrap {profile:LearningProfile;catalog:Direction[];direction:Direction|null;goals:Goals;navigation:LearningNavGroup[];completed:{lesson_id:string;module_id:string;xp:number}[];modules:Direction['modules']}
interface State {data:LearningBootstrap|null;loading:boolean;error:string;refresh:()=>Promise<void>;switchProfile:(directionId:string,specializationId?:string|null)=>Promise<void>}
const Context=createContext<State|null>(null);
export function LearningProvider({children}:{children:ReactNode}){
 const {user,refresh:refreshUser}=useAuth();
 const result=useApi<LearningBootstrap>(user?.role==='student'?'/learning/bootstrap':null);
 useEffect(()=>{
  const onChange=(event:StorageEvent)=>{if(event.key==='365step-profile-changed')void refreshUser();};
  const onFocus=()=>{void refreshUser();void result.reload();};
  window.addEventListener('storage',onChange);window.addEventListener('focus',onFocus);
  return()=>{window.removeEventListener('storage',onChange);window.removeEventListener('focus',onFocus);};
 },[refreshUser,result.reload]);
 async function switchProfile(directionId:string,specializationId:string|null=null){
  if(!result.data)throw new Error('Профиль ещё загружается');
  try{
   await flushLearningDrafts();
   const next=await api<LearningProfile>('/learning/profile',{method:'PUT',body:{directionId,specializationId,expectedVersion:result.data.profile.version}});
   try{localStorage.setItem('365step-profile-changed',JSON.stringify({userId:user?.id,version:next.version,at:Date.now()}));}catch{}
   await refreshUser();await result.reload();
  }catch(error){await refreshUser();await result.reload();throw error;}
 }
 return <Context.Provider value={{data:result.data,loading:result.loading,error:result.error,refresh:result.reload,switchProfile}}>{children}</Context.Provider>;
}
export function useLearning(){const state=useContext(Context);if(!state)throw new Error('LearningProvider missing');return state;}
