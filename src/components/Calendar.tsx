'use client';
import { addDays, todayBR, weekdayOf } from '@/lib/time';
import { IconBack, IconChevron } from './Icons';

export type DayInfo = { status: string; count: number; taken?: number };
const NAMES = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb']; // sem domingo: não há atendimento
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function shiftMonth(m: string, delta: number) {
  const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function Calendar({ month, days, selected, onSelect, onMonth }: {
  month: string; days: Record<string, DayInfo> | null; selected: string | null; onSelect: (d: string) => void; onMonth: (m: string) => void;
}) {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const days0: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) if (weekdayOf(d) !== 0) days0.push(d);
  const cells: (string | null)[] = [...Array(weekdayOf(days0[0]) - 1).fill(null), ...days0];
  const legend: Record<string, string> = { full: 'Sem horários', blocked: 'Bloqueado', closed: 'Fechado', past: 'Passado', out_of_range: 'Fora do prazo' };
  const today = todayBR();
  const nav = 'grid h-11 w-11 place-items-center rounded-full border border-rose-200 bg-white/70 text-rose-600 transition hover:bg-rose-50 hover:scale-105 active:scale-95';
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => onMonth(shiftMonth(month, -1))} className={nav}><IconBack /></button>
        <h3 key={month} className="animate-fadeIn text-2xl font-semibold capitalize text-rose-600">{MONTHS[+month.slice(5) - 1]} <span className="font-normal text-nude-700">{month.slice(0, 4)}</span></h3>
        <button type="button" aria-label="Próximo mês" onClick={() => onMonth(shiftMonth(month, 1))} className={nav}><IconChevron width={16} height={16} /></button>
      </div>
      <div className="grid grid-cols-6 gap-1 text-center text-[11px] font-medium uppercase tracking-widest text-nude-700">{NAMES.map((n) => <div key={n}>{n}</div>)}</div>
      <div key={month} className="mt-2 grid animate-fadeIn grid-cols-6 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const info = days?.[d];
          const ok = info?.status === 'available';
          const sel = d === selected;
          const state = sel ? 'bg-gradient-to-br from-rose-600 to-rose-500 font-semibold text-white shadow-lg shadow-rose-600/30 scale-105'
            : ok ? 'bg-rose-50 font-medium text-rose-600 hover:-translate-y-0.5 hover:bg-rose-100 hover:shadow-md'
            : info?.status === 'full' ? 'bg-nude-100 text-nude-700/70 line-through decoration-rose-200'
            : info?.status === 'blocked' ? 'bg-nude-200/70 text-nude-700/60'
            : 'text-nude-200';
          return (
            <button key={d} type="button" disabled={!ok} onClick={() => onSelect(d)} title={info ? (ok ? `${info.count} horários` : legend[info.status]) : ''} aria-pressed={sel}
              className={`relative aspect-square min-h-11 rounded-2xl text-sm transition duration-300 ${state} ${d === today && !sel ? 'ring-2 ring-ouro/70' : ''}`}>
              {+d.slice(8)}
              {ok && <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5"><i className={`h-1 w-1 rounded-full ${sel ? 'bg-white/80' : 'bg-ouro'}`} />{!!info?.taken && <i className={`h-1 w-1 rounded-full ${sel ? 'bg-white/80' : 'bg-rose-500'}`} />}</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-nude-700">
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-200" />com horários</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-nude-200" />sem horários ou fechado</span><span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full ring-2 ring-ouro/70" />hoje</span>
        <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-rose-500" />já tem horários ocupados</span>
      </p>
    </div>
  );
}
