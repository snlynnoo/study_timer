export const isValidTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function durationBetween(start:string,end:string) {
  if(!isValidTime(start)||!isValidTime(end))return 0;
  const [startHour,startMinute]=start.split(':').map(Number),[endHour,endMinute]=end.split(':').map(Number);
  return (endHour*60+endMinute-startHour*60-startMinute+1440)%1440;
}

export function parseTimePaste(value:string):string|null {
  const raw=value.trim();
  let result:string;
  if(/^\d{1,2}:\d{2}$/.test(raw))result=raw.padStart(5,'0');
  else if(/^\d{3,4}$/.test(raw)){const digits=raw.padStart(4,'0');result=`${digits.slice(0,2)}:${digits.slice(2)}`;}
  else return null;
  return isValidTime(result)?result:null;
}
