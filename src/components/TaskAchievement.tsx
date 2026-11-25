import React,{useState} from 'react';
import {format} from 'date-fns';
import {ChartNoAxesCombined,Target,CheckCheck,ClipboardList,Info} from 'lucide-react';
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {buildTaskAchievement,type AchievementTask} from '../lib/taskAchievement';
import {PALETTE} from '../lib/palette';

export default function TaskAchievement({tasks,month,loading,unavailable=false}:{tasks:readonly AchievementTask[];month:Date;loading:boolean;unavailable?:boolean}) {
  const [mode,setMode]=useState<'counts'|'rate'>('counts');
  const [showInfo,setShowInfo]=useState(false);
  const stats=buildTaskAchievement(tasks,month);
  const period=format(month,'MMMM yyyy');
  const rateLabel=stats.rate===null?'—':`${stats.rate}%`;
  return <section className="task-achievement" aria-labelledby="achievement-heading" aria-busy={loading}>
    <button type="button" className="achievement-info-button" aria-label="Task achievement information" aria-expanded={showInfo} aria-controls="achievement-information" onClick={()=>setShowInfo(!showInfo)}><Info size={20}/></button>
    <header className="achievement-heading"><div><h2 id="achievement-heading"><ChartNoAxesCombined size={21}/>Task achievement</h2><p>{period} · Completed tasks compared with your plan</p></div>
      <div className="achievement-mode" role="group" aria-label="Task achievement chart">
        <button type="button" aria-pressed={mode==='counts'} onClick={()=>setMode('counts')}>Plan vs achieved</button>
        <button type="button" aria-pressed={mode==='rate'} onClick={()=>setMode('rate')}>Achievement %</button>
      </div>
    </header>
    {showInfo&&<div id="achievement-information" className="achievement-information">
      <p>Achievement = completed ÷ planned tasks due through today. Future dates are excluded from the rate. Completed tasks are grouped by their scheduled date.</p>
      <p>Days without planned tasks have no percentage; gaps do not mean missed tasks.</p>
    </div>}
    {loading?<p role="status" className="achievement-empty">Loading task achievement…</p>:unavailable?<p role="status" className="achievement-empty">Task achievement is unavailable until your tasks can be loaded.</p>:<>
      <div className="achievement-metrics">
        <div><span className="achievement-metric-icon"><ClipboardList size={19}/></span><div><span>Planned to date</span><strong>{stats.planned}</strong></div></div>
        <div><span className="achievement-metric-icon completed"><CheckCheck size={19}/></span><div><span>Achieved to date</span><strong>{stats.achieved}</strong></div></div>
        <div><span className="achievement-metric-icon rate"><Target size={19}/></span><div><span>Achievement rate</span><strong>{rateLabel}</strong></div></div>
      </div>
      <p className="achievement-status" role="status">{stats.planned?`${stats.achieved} of ${stats.planned} tasks completed · ${stats.pending} still to do`:'No tasks due in this month yet.'}{stats.upcoming>0&&` · ${stats.upcoming} scheduled for future dates`}</p>
      {stats.monthPlanned>0?<div className="achievement-chart" role="img" aria-label={mode==='counts'?`Daily planned and completed tasks for ${period}. ${stats.achieved} of ${stats.planned} tasks due so far completed.`:`Daily task achievement percentages for ${period}. Overall achievement ${rateLabel}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.days} margin={{top:16,right:20,left:0,bottom:4}} accessibilityLayer>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false}/>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'var(--muted)',fontSize:12}} minTickGap={20} label={{value:'Scheduled day',position:'insideBottom',offset:-2,fill:'var(--muted)',fontSize:12}} height={48}/>
            <YAxis domain={mode==='rate'?[0,100]:[0,'auto']} allowDecimals={false} axisLine={false} tickLine={false} width={48} tick={{fill:'var(--muted)',fontSize:12}} tickFormatter={value=>mode==='rate'?`${value}%`:String(value)}/>
            <Tooltip labelFormatter={label=>`${format(month,'MMM')} ${label}`} formatter={(value:any,name:any)=>[mode==='rate'?`${value}%`:`${value} ${Number(value)===1?'task':'tasks'}`,name]} contentStyle={{background:'var(--surface)',color:'var(--ink)',border:'1px solid var(--line)',borderRadius:12}} labelStyle={{color:'var(--ink)'}}/>
            <Legend wrapperStyle={{fontSize:13,paddingTop:8}}/>
            {mode==='counts'?<>
              <Line key="planned" type="linear" dataKey="planned" name="Planned" stroke={PALETTE.teal} strokeWidth={2} dot={false} activeDot={{r:5}}/>
              <Line key="achieved" type="linear" dataKey="achieved" name="Achieved" stroke={PALETTE.blue} strokeWidth={2.5} dot={{r:2}} activeDot={{r:5}} connectNulls={false}/>
            </>:<Line key="rate" type="linear" dataKey="rate" name="Achievement" stroke={PALETTE.blue} strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}} connectNulls={false}/>}
          </LineChart>
        </ResponsiveContainer>
      </div>:<div className="achievement-empty"><Target size={28}/><p>Add tasks to see how your plan compares with what you complete.</p></div>}
    </>}
  </section>;
}
