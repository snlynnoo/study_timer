export function formatBreakMinutes(seconds:number|null|undefined){
  if(seconds==null)return '—';
  if(seconds>0&&seconds<6)return '<0.1 min';
  return `${Number((seconds/60).toFixed(1))} min`;
}
export default function BreakDuration({seconds}:{seconds?:number|null}){
  return <span className="break-duration-tag" title={seconds==null?'Break time was not recorded for this session.':`${seconds} seconds of active break time`} aria-label={seconds==null?'Break time not recorded':`Break ${formatBreakMinutes(seconds)}`}><span>Break</span> {formatBreakMinutes(seconds)}</span>;
}
