import React from 'react';
import {Reorder,useDragControls} from 'motion/react';
import {GripVertical} from 'lucide-react';

export default function SortableTask({id,title,completed,disabled,onStart,onEnd,onMove,children}:{key?:string;id:string;title:string;completed:boolean;disabled:boolean;onStart:()=>void;onEnd:()=>void;onMove:(direction:number)=>void;children:React.ReactNode}) {
  const controls=useDragControls();
  return <Reorder.Item as="article" value={id} dragListener={false} dragMomentum={false} dragControls={controls} onDragStart={onStart} onDragEnd={onEnd} className={`todo-item ${completed?'is-complete':''}`} whileDrag={{boxShadow:'0 8px 24px #1f314826',zIndex:2}}>
    <button type="button" className="todo-drag-handle" aria-disabled={disabled} aria-label={`Reorder ${title}`} title="Drag to reorder, or use the Up and Down arrow keys" onPointerDown={event=>{if(!disabled)controls.start(event);}} onKeyDown={event=>{
      if(!disabled&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();onMove(event.key==='ArrowUp'?-1:1);}
    }}><GripVertical size={18}/></button>
    {children}
  </Reorder.Item>;
}
