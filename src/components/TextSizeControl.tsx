import React from 'react';
import { Minus, Plus } from 'lucide-react';

export default function TextSizeControl({value,onChange}:{value:number;onChange:(size:number)=>void}) {
  return <div className="text-size-control" role="group" aria-label="Text size">
    <span>Text size</span>
    <button type="button" aria-label="Decrease text size" disabled={value<=14} onClick={()=>onChange(Math.max(14,value-1))}><Minus size={16}/></button>
    <output aria-live="polite" aria-label="Current text size">{Math.round(value/16*100)}%</output>
    <button type="button" aria-label="Increase text size" disabled={value>=22} onClick={()=>onChange(Math.min(22,value+1))}><Plus size={16}/></button>
    <button type="button" className="text-size-reset" onClick={()=>onChange(16)}>Reset</button>
  </div>;
}
