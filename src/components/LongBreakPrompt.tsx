import {useEffect,useRef} from 'react';
import {Coffee} from 'lucide-react';
export default function LongBreakPrompt({minutes,onOkay}:{minutes:number;onOkay:()=>void}){
  const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{button.current?.focus();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[]);
  return <div className="long-break-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="long-break-title" aria-describedby="long-break-description" className="long-break-dialog" onKeyDown={event=>{if(event.key==='Tab'){event.preventDefault();button.current?.focus();}}}>
    <span className="long-break-icon"><Coffee size={28}/></span><span className="cycle-complete-label">4 / 4 FOCUS SESSIONS COMPLETE</span>
    <h2 id="long-break-title">You need a long break now.</h2><p id="long-break-description">You’ve completed four focus sessions. Take {minutes} minutes to recharge.</p>
    <button ref={button} onClick={onOkay}>Okay</button>
  </section></div>;
}
