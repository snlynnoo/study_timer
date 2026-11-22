import type {Session} from '../types';

export function buildDistribution(sessions:Session[],mode:'mainTask'|'topic',order:'asc'|'desc') {
  const groups=new Map<string,{name:string;minutes:number}>();
  for(const session of sessions) {
    const name=(session[mode]||'').trim()||'Unspecified';
    const key=name.toLocaleLowerCase();
    const item=groups.get(key)||{name,minutes:0};item.minutes+=session.duration;groups.set(key,item);
  }
  return [...groups.values()].sort((a,b)=>(order==='asc'?a.minutes-b.minutes:b.minutes-a.minutes)||a.name.localeCompare(b.name));
}
