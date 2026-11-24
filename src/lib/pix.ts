/**
 * PIX estático (BR Code / "copia e cola") com valor e identificador da reserva.
 * O dinheiro cai direto na chave da profissional; nada passa por intermediário.
 */
export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const plain = (s: string, max: number) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim().slice(0, max);

export function normalizePixKey(key: string, type: PixKeyType): string {
  const k = key.trim();
  switch (type) {
    case 'cpf': case 'cnpj': return k.replace(/\D/g, '');
    case 'phone': { const d = k.replace(/\D/g, ''); return `+${d.startsWith('55') && d.length >= 12 ? d : `55${d}`}`; }
    case 'email': return k.toLowerCase();
    default: return k;
  }
}

export function buildPixPayload(o: { key: string; keyType: PixKeyType; holder: string; city: string; amountCents: number; txid: string }): string {
  const key = normalizePixKey(o.key, o.keyType);
  const account = tlv('00', 'br.gov.bcb.pix') + tlv('01', key);
  const txid = o.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const body =
    tlv('00', '01') + tlv('01', '11') + tlv('26', account) + tlv('52', '0000') + tlv('53', '986') +
    tlv('54', (o.amountCents / 100).toFixed(2)) + tlv('58', 'BR') + tlv('59', plain(o.holder, 25) || 'RECEBEDOR') +
    tlv('60', plain(o.city, 15) || 'BRASIL') + tlv('62', tlv('05', txid)) + '6304';
  return body + crc16(body);
}
