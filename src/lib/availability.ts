import { addDays, hmToMin, minToHm, toInstant, todayBR, weekdayOf } from './time';

export type WeeklyHour = { weekday: number; active: boolean; open_time: string; close_time: string };
export type Break = { weekday: number | null; start_time: string; end_time: string };
export type Block = { date_from: string; date_to: string; start_time: string | null; end_time: string | null };
export type WeeklySlot = { weekday: number; slot_time: string };
export type Busy = { start: Date; end: Date };
export type AvailabilityConfig = {
  weeklyHours: WeeklyHour[]; breaks: Break[]; blocks: Block[];
  /** horários fixos de início por dia da semana (se o dia tiver, valem no lugar de abertura/fechamento + intervalo) */
  weeklySlots?: WeeklySlot[];
  stepMin: number; minNoticeHours: number; maxDaysAhead: number;
};

/** Intervalos (minutos do dia) indisponíveis na data. `null` = dia inteiro bloqueado. */
function unavailableRanges(date: string, cfg: AvailabilityConfig): [number, number][] | null {
  const out: [number, number][] = [];
  for (const b of cfg.blocks) {
    if (date < b.date_from || date > b.date_to) continue;
    if (!b.start_time || !b.end_time) return null;
    out.push([hmToMin(b.start_time), hmToMin(b.end_time)]);
  }
  const wd = weekdayOf(date);
  for (const br of cfg.breaks) if (br.weekday === null || br.weekday === wd) out.push([hmToMin(br.start_time), hmToMin(br.end_time)]);
  return out;
}

export type DayStatus = 'available' | 'full' | 'blocked' | 'closed' | 'past' | 'out_of_range';

/** `slots` = horários livres; `taken` = horários que seriam válidos mas já estão ocupados por outro atendimento (a cliente vê, mas não pode escolher). */
export function computeDay(date: string, durationMin: number, cfg: AvailabilityConfig, busy: Busy[], now = new Date()): { status: DayStatus; slots: string[]; taken: string[] } {
  const today = todayBR(now);
  if (date < today) return { status: 'past', slots: [], taken: [] };
  if (date > addDays(today, cfg.maxDaysAhead)) return { status: 'out_of_range', slots: [], taken: [] };
  const hours = cfg.weeklyHours.find((h) => h.weekday === weekdayOf(date));
  if (!hours || !hours.active) return { status: 'closed', slots: [], taken: [] };
  const un = unavailableRanges(date, cfg);
  if (un === null) return { status: 'blocked', slots: [], taken: [] };

  const earliest = now.getTime() + cfg.minNoticeHours * 3600_000;
  const slots: string[] = [], taken: string[] = [];
  const fixed = (cfg.weeklySlots ?? []).filter((x) => x.weekday === weekdayOf(date)).map((x) => hmToMin(x.slot_time)).sort((x, y) => x - y);
  const open = hmToMin(hours.open_time), close = hmToMin(hours.close_time);
  const candidates: number[] = [];
  if (fixed.length) candidates.push(...fixed);
  else for (let m = open; m + durationMin <= close; m += cfg.stepMin) candidates.push(m);
  for (const m of candidates) {
    if (un.some(([a, b]) => m < b && m + durationMin > a)) continue;
    const start = toInstant(date, minToHm(m));
    if (start.getTime() < earliest) continue;
    const end = new Date(start.getTime() + durationMin * 60_000);
    if (busy.some((x) => start < x.end && end > x.start)) { taken.push(minToHm(m)); continue; } // conflito considerando a duração
    slots.push(minToHm(m));
  }
  return { status: slots.length ? 'available' : 'full', slots, taken };
}
