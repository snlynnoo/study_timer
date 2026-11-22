export function parseBreakMinutes(value:string):number|null {
  if(!value.trim())return null;
  const minutes=Number(value);
  if(!Number.isFinite(minutes)||minutes<0||minutes>10080)throw new Error('Enter break minutes between 0 and 10,080, or leave blank for unknown.');
  return Math.round(minutes*60);
}
