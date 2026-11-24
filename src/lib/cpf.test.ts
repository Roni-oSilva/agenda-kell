import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf } from './cpf';

describe('cpf', () => {
  it('valida pelos dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });
  it('formata com máscara enquanto digita', () => {
    expect(formatCpf('5299')).toBe('529.9');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(formatCpf('529982247259999')).toBe('529.982.247-25');
  });
});
