import {Clock,Coffee,Repeat,Target,Zap,CheckCircle2} from 'lucide-react';
import type {TimerSettings} from '../types';
export default function PomodoroInfo({settings}:{settings:TimerSettings}){
  const steps=[
    {icon:<Target size={23}/>,title:'Choose one task',description:'Pick a main task and a specific topic before you start. Keep the next step small and clear.'},
    {icon:<Clock size={23}/>,title:`Focus for ${settings.work} minutes`,description:'Start the timer and work on that task. Pause if you need to; your remaining time is kept.'},
    {icon:<Coffee size={23}/>,title:`Take a ${settings.shortBreak}-minute break`,description:'Step away, stretch, or get some water. Start the break timer to record the time you actually take.'},
    {icon:<Repeat size={23}/>,title:'Complete four focus sessions',description:'Follow your session counter from 1 / 4 to 4 / 4. A short break separates the first three sessions.'},
    {icon:<Zap size={23}/>,title:`Recharge with a ${settings.longBreak}-minute long break`,description:'After session 4, acknowledge the reminder with Okay. The timer switches to Long Break. Completing it starts a fresh cycle.'},
  ];
  return <section className="guide-page guide-redesign" aria-labelledby="guide-heading">
    <header className="guide-heading"><span className="guide-label"><Clock size={16}/>THE POMODORO TECHNIQUE</span><h1 id="guide-heading">A simple rhythm for focused work</h1><p>Work on one task, take a break, and repeat. Your current timer settings shape your cycle.</p></header>
    <ol className="guide-steps">{steps.map((step,index)=><li key={step.title} className="guide-step"><div className="guide-step-top"><span className="guide-step-icon">{step.icon}</span><span className="guide-step-number">STEP {index+1}</span></div><h2>{step.title}</h2><p>{step.description}</p></li>)}</ol>
    <div className="guide-notes"><h2><CheckCircle2 size={20}/>Keep it practical</h2><ul><li>Silence distractions before starting your focus session.</li><li>Break time is recorded separately from focus time and excludes pauses.</li><li>You can adjust durations, sounds, and colors on the Settings page.</li></ul></div>
  </section>;
}
