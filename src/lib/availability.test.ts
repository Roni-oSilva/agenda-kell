import { describe, expect, it } from 'vitest';
import { computeDay, type AvailabilityConfig } from './availability';
import { toInstant } from './time';

const wh = (d: number, active = true) => ({ weekday: d, active, open_time: '09:00', close_time: '18:00' });
const cfg: AvailabilityConfig = {
  weeklyHours: [0, 1, 2, 3, 4, 5, 6].map((d) => wh(d, d !== 0)), // domingo fechado
  breaks: [{ weekday: null, start_time: '12:00', end_time: '13:00' }],
  blocks: [], stepMin: 30, minNoticeHours: 2, maxDaysAhead: 60,
};
const now = new Date('2026-11-20T12:00:00-03:00'); // sexta
const DAY = '2026-11-23'; // segunda

describe('availability', () => {
  it('respeita intervalo de almoço e duração do serviço', () => {
    const { slots } = computeDay(DAY, 120, cfg, [], now);
    expect(slots).toContain('09:00');
    expect(slots).toContain('10:00');
    expect(slots).not.toContain('10:30'); // 10:30-12:30 invade o almoço
    expect(slots).not.toContain('11:30');
    expect(slots).toContain('13:00');
    expect(slots).toContain('16:00');
    expect(slots).not.toContain('16:30'); // passa do fechamento
  });
  it('14h-16h ocupado bloqueia qualquer horário conflitante', () => {
    const busy = [{ start: toInstant(DAY, '14:00'), end: toInstant(DAY, '16:00') }];
    const { slots } = computeDay(DAY, 120, cfg, busy, now);
    for (const s of ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30']) expect(slots).not.toContain(s);
    expect(slots).toContain('16:00');
    expect(slots).toContain('10:00');
  });
  it('horários ocupados aparecem como indisponíveis (taken), não como livres', () => {
    const busy = [{ start: toInstant(DAY, '14:00'), end: toInstant(DAY, '16:00') }];
    const r = computeDay(DAY, 60, cfg, busy, now);
    expect(r.taken).toEqual(['13:30', '14:00', '14:30', '15:00', '15:30']); // 13:30 (60 min) invade as 14h
    for (const t of r.taken) expect(r.slots).not.toContain(t);
    expect(r.taken).not.toContain('12:00'); // almoço não é "ocupado"
  });
  it('horários fixos por dia: só aparecem os horários cadastrados e os ocupados ficam marcados', () => {
    const fixedCfg = { ...cfg, breaks: [], weeklySlots: [8, 13, 15, 18].map((h) => ({ weekday: 1, slot_time: `${String(h).padStart(2, '0')}:00:00` })) };
    expect(computeDay(DAY, 60, fixedCfg, [], now).slots).toEqual(['08:00', '13:00', '15:00', '18:00']);
    const busy = [{ start: toInstant(DAY, '13:00'), end: toInstant(DAY, '15:00') }]; // atendimento de 2h às 13h
    const r = computeDay(DAY, 60, fixedCfg, busy, now);
    expect(r.slots).toEqual(['08:00', '15:00', '18:00']);
    expect(r.taken).toEqual(['13:00']);
  });
  it('dia fechado, bloqueado, passado e fora do limite', () => {
    expect(computeDay('2026-11-22', 60, cfg, [], now).status).toBe('closed');
    expect(computeDay(DAY, 60, { ...cfg, blocks: [{ date_from: DAY, date_to: DAY, start_time: null, end_time: null }] }, [], now).status).toBe('blocked');
    expect(computeDay('2026-11-19', 60, cfg, [], now).status).toBe('past');
    expect(computeDay('2027-06-01', 60, cfg, [], now).status).toBe('out_of_range');
  });
  it('bloqueia faixa de horário sem bloquear o dia', () => {
    const c = { ...cfg, blocks: [{ date_from: DAY, date_to: DAY, start_time: '15:00', end_time: '16:00' }] };
    const { slots, status } = computeDay(DAY, 60, c, [], now);
    expect(status).toBe('available');
    expect(slots).not.toContain('15:00');
    expect(slots).not.toContain('14:30');
    expect(slots).toContain('16:00');
  });
  it('antecedência mínima e dia lotado', () => {
    const late = new Date('2026-11-20T15:30:00-03:00');
    const { slots } = computeDay('2026-11-20', 60, cfg, [], late);
    expect(slots).not.toContain('17:00'); // 17:00 < 15:30 + 2h
    const full = computeDay(DAY, 60, cfg, [{ start: toInstant(DAY, '08:00'), end: toInstant(DAY, '19:00') }], now);
    expect(full.status).toBe('full');
  });
});
