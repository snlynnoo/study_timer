import React,{useRef} from 'react';
import {parseTimePaste} from '../lib/timeInput';

export default function TimeInput({value,onChange,label,compact=false}:{value:string;onChange:(value:string)=>void;label:string;compact?:boolean}) {
  const hoursInput=useRef<HTMLInputElement>(null);
  const minutesInput=useRef<HTMLInputElement>(null);
  const [hours='',minutes='']=value.split(':');
  const update=(part:'hours'|'minutes',raw:string)=>{
    const digits=raw.replace(/\D/g,'').slice(0,2);
    if(part==='hours'&&digits.length===2){minutesInput.current?.focus();minutesInput.current?.select();}
    onChange(part==='hours'?`${digits}:${minutes}`:`${hours}:${digits}`);
  };
  const pad=(part:'hours'|'minutes',digits:string)=>{
    if(digits.length===1)onChange(part==='hours'?`${digits.padStart(2,'0')}:${minutes}`:`${hours}:${digits.padStart(2,'0')}`);
  };
  const paste=(event:React.ClipboardEvent<HTMLInputElement>)=>{
    const parsed=parseTimePaste(event.clipboardData.getData('text'));
    if(parsed){event.preventDefault();minutesInput.current?.focus();minutesInput.current?.select();onChange(parsed);}
  };
  return <div className={`numeric-time-input ${compact?'compact':''}`} role="group" aria-label={label}>
    <input ref={hoursInput} aria-label={`${label} hours`} type="text" inputMode="numeric" autoComplete="off" placeholder="HH" required maxLength={2} pattern="([01]?[0-9]|2[0-3])" value={hours} onFocus={event=>event.currentTarget.select()} onChange={event=>update('hours',event.target.value)} onBlur={event=>pad('hours',event.currentTarget.value)} onPaste={paste} onKeyDown={event=>{if(event.key===':'||event.key==='ArrowRight'&&event.currentTarget.selectionStart===hours.length){event.preventDefault();minutesInput.current?.focus();minutesInput.current?.select();}}}/>
    <span className="time-colon" aria-hidden="true">:</span>
    <input ref={minutesInput} aria-label={`${label} minutes`} type="text" inputMode="numeric" autoComplete="off" placeholder="mm" required maxLength={2} pattern="[0-5]?[0-9]" value={minutes} onFocus={event=>event.currentTarget.select()} onChange={event=>update('minutes',event.target.value)} onBlur={event=>pad('minutes',event.currentTarget.value)} onPaste={paste} onKeyDown={event=>{if(event.key==='Backspace'&&!minutes||event.key==='ArrowLeft'&&event.currentTarget.selectionStart===0){event.preventDefault();hoursInput.current?.focus();hoursInput.current?.select();}}}/>
  </div>;
}
