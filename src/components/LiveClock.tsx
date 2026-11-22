import { useEffect, useState } from 'react';
import { format } from 'date-fns';
export default function LiveClock() {
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer);},[]);
  return <time className="header-clock" dateTime={now.toISOString()} aria-label={`Local date and time: ${format(now,'EEEE, MMMM d, HH:mm')}`}><span>{format(now,'EEE, MMM d')}</span><strong>{format(now,'HH:mm')}</strong></time>;
}
