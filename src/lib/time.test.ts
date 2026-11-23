import { describe, expect, it } from 'vitest';
import { normalizePhone, fmtDateBR, fmtTimeBR } from './time';

describe('time', () => {
  it('normaliza telefone: mesmo número em formatos diferentes = mesma cliente', () => {
    const a = normalizePhone('(11) 91234-5678'), b = normalizePhone('+55 11 91234 5678'), c = normalizePhone('5511912345678');
    expect(a).toBe('5511912345678'); expect(b).toBe(a); expect(c).toBe(a);
    expect(normalizePhone('123')).toBeNull();
  });
  it('converte para horário de Brasília', () => {
    expect(fmtTimeBR('2026-11-23T17:00:00Z')).toBe('14:00');
    expect(fmtDateBR('2026-11-24T01:30:00Z')).toBe('23/11/2026');
  });
});
