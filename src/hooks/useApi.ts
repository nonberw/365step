import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/auth';
/** A response belongs to one URL, account and profile version, never the next screen. */
export function useApi<T>(path:string|null,poll?:number){
 const {user}=useAuth();
 const key=`${user?.id??'guest'}:${user?.learningProfile?.version??0}:${JSON.stringify(user?.goals??{})}:${path??''}`;
 const [state,setState]=useState<{key:string;data:T|null;error:string;loading:boolean}>({key,data:null,error:'',loading:!!path});
 const generation=useRef(0),active=useRef(key);active.current=key;
 const reload=useCallback(async()=>{
  if(!path)return;
  const ticket=++generation.current;
  try{const data=await api<T>(path);if(active.current===key&&generation.current===ticket)setState({key,data,error:'',loading:false});}
  catch(error){if(active.current===key&&generation.current===ticket)setState({key,data:null,error:(error as Error).message,loading:false});}
 },[path,key]);
 useEffect(()=>{if(!path){setState({key,data:null,error:'',loading:false});return;}setState({key,data:null,error:'',loading:true});void reload();const timer=poll?window.setInterval(reload,poll):undefined;return()=>{generation.current++;if(timer)clearInterval(timer);};},[key,path,poll,reload]);
 const setData=useCallback((value:T|null|((previous:T|null)=>T|null))=>setState(s=>({key,data:typeof value==='function'?(value as (p:T|null)=>T|null)(s.key===key?s.data:null):value,error:'',loading:false})),[key]);
 return {data:state.key===key?state.data:null,error:state.key===key?state.error:'',loading:!!path&&(state.key!==key||state.loading),setData,reload};
}
