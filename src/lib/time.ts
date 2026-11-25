// Brasil não tem horário de verão desde 2019: America/Sao_Paulo = UTC-03:00 fixo.
export const TZ_OFFSET = '-03:00';
export const toInstant = (date: string, hm: string) => new Date(`${date}T${hm.slice(0, 5)}:00${TZ_OFFSET}`);
export const todayBR = (now = new Date()) => new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
/** Não atendemos aos domingos (regra fixa do estúdio). */
export const isSunday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const addDays = (date: string, n: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);
export const hmToMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const minToHm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dateOfInstant = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
export const fmtDateBR = (iso: string) => dateOfInstant(iso).split('-').reverse().join('/');
export const fmtTimeBR = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(11, 16);
export const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  const n = d.startsWith('55') && d.length >= 12 ? d : '55' + d;
  return /^55\d{10,11}$/.test(n) ? n : null; // DDD + 8/9 dígitos
}
