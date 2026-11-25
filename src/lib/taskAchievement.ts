import {eachDayOfInterval,endOfMonth,format,startOfMonth} from 'date-fns';

export interface AchievementTask {date:string;completed:boolean}
export function buildTaskAchievement(tasks:readonly AchievementTask[],month:Date,now=new Date()) {
  const today=format(now,'yyyy-MM-dd');
  const days=eachDayOfInterval({start:startOfMonth(month),end:endOfMonth(month)}).map(date=>{
    const key=format(date,'yyyy-MM-dd');
    return {date:key,day:format(date,'d'),planned:0,completed:0,due:key<=today};
  });
  const byDate=new Map(days.map(day=>[day.date,day]));
  for(const task of tasks){const day=byDate.get(task.date);if(day){day.planned++;if(task.completed)day.completed++;}}
  const dueDays=days.filter(day=>day.due);
  const planned=dueDays.reduce((sum,day)=>sum+day.planned,0);
  const achieved=dueDays.reduce((sum,day)=>sum+day.completed,0);
  const upcoming=days.filter(day=>!day.due).reduce((sum,day)=>sum+day.planned,0);
  return {
    planned,achieved,pending:planned-achieved,upcoming,
    rate:planned?Number((achieved/planned*100).toFixed(1)):null,
    monthPlanned:days.reduce((sum,day)=>sum+day.planned,0),
    days:days.map(day=>({...day,achieved:day.due?day.completed:null,rate:day.due&&day.planned?Number((day.completed/day.planned*100).toFixed(1)):null})),
  };
}
