import { describe, expect, it } from 'vitest';
import { buildPixPayload, crc16, normalizePixKey } from './pix';

describe('pix estático', () => {
  it('CRC16-CCITT confere com o vetor padrão', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  it('monta o código com valor, chave e CRC válido', () => {
    const p = buildPixPayload({ key: 'teste@exemplo.com', keyType: 'email', holder: 'Maria da Silva', city: 'Maraba', amountCents: 3000, txid: 'ABC12345' });
    expect(p.startsWith('000201010211')).toBe(true);
    expect(p).toContain('br.gov.bcb.pix0117teste@exemplo.com');
    expect(p).toContain('540530.00');
    expect(p).toContain('5802BR');
    expect(p).toContain('5914MARIA DA SILVA');
    expect(p).toContain('0508ABC12345');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4)); // CRC recalculado bate com o final
  });
  it('normaliza chaves', () => {
    expect(normalizePixKey('(94) 99972-1452', 'phone')).toBe('+5594999721452');
    expect(normalizePixKey('529.982.247-25', 'cpf')).toBe('52998224725');
    expect(normalizePixKey(' Fulano@Mail.com ', 'email')).toBe('fulano@mail.com');
  });
});
