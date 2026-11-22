import type { ThemeSettings } from '../types';

export const PALETTE = {
  teal: '#779fa1',
  orange: '#f49d37',
  blue: '#3d62a4',
  rust: '#a72608',
  olive: '#4b543b',
} as const;

export const TIMER_THEME_OPTIONS = [
  {name:'Blue',value:'bg-indigo-900',color:PALETTE.blue},
  {name:'Muted teal',value:'bg-teal-500',color:PALETTE.teal},
  {name:'Orange',value:'bg-amber-500',color:PALETTE.orange},
  {name:'Rust',value:'bg-red-800',color:PALETTE.rust},
  {name:'Olive',value:'bg-lime-900',color:PALETTE.olive},
];
const aliases: Record<string,string> = {
  'bg-slate-700':'bg-indigo-900','bg-sky-500':'bg-indigo-900','bg-indigo-500':'bg-indigo-900','bg-violet-500':'bg-indigo-900',
  'bg-yellow-400':'bg-amber-500','bg-green-500':'bg-lime-900','bg-emerald-500':'bg-lime-900','bg-rose-500':'bg-red-800',
};
export function normalizeTimerTheme(theme: ThemeSettings): ThemeSettings {
  const normalize=(value:string)=>TIMER_THEME_OPTIONS.some(option=>option.value===value)?value:(aliases[value]||'bg-indigo-900');
  return {work:normalize(theme.work),shortBreak:normalize(theme.shortBreak),longBreak:normalize(theme.longBreak)};
}
export const timerColor = (value:string) => TIMER_THEME_OPTIONS.find(option=>option.value===(aliases[value]||value))?.color || PALETTE.blue;
