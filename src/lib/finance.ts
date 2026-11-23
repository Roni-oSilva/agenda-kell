import { addDays, dateOfInstant, weekdayOf } from './time';

export type FPayment = { booking_id: string; method: string; kind: string; amount_cents: number; paid_at: string };
export type FBooking = { id: string; service_name: string; customer_id: string; status: string; total_cents: number; paid_cents: number; start_at: string };

const INACTIVE = ['cancelado', 'nao_compareceu'];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const weekStart = (d: string) => addDays(d, -((weekdayOf(d) + 6) % 7)); // segunda-feira

/**
 * payments: pagamentos APROVADOS no período (dinheiro efetivamente recebido, por data de pagamento).
 * bookings: agendamentos do período (por data do atendimento) — base do "previsto".
 * Sinais de reservas canceladas continuam contando como recebidos (sem reembolso).
 */
export function summarize(payments: FPayment[], bookings: FBooking[]) {
  const byBooking = new Map(bookings.map((b) => [b.id, b]));
  const active = bookings.filter((b) => !INACTIVE.includes(b.status));
  const group = (keyFn: (d: string) => string) => {
    const m = new Map<string, number>();
    for (const p of payments) { const k = keyFn(dateOfInstant(p.paid_at)); m.set(k, (m.get(k) ?? 0) + p.amount_cents); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, cents]) => ({ period, cents }));
  };
  const rank = (keyFn: (p: FPayment) => string) => {
    const m = new Map<string, { count: number; cents: number }>();
    for (const p of payments) { const k = keyFn(p); const e = m.get(k) ?? { count: 0, cents: 0 }; e.count++; e.cents += p.amount_cents; m.set(k, e); }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.cents - a.cents);
  };
  const sold = new Map<string, number>();
  for (const b of active) sold.set(b.service_name, (sold.get(b.service_name) ?? 0) + 1);
  return {
    received_cents: sum(payments.map((p) => p.amount_cents)),
    expected_cents: sum(active.map((b) => b.total_cents)),
    deposits_cents: sum(payments.filter((p) => p.kind === 'sinal').map((p) => p.amount_cents)),
    full_payments_cents: sum(payments.filter((p) => p.kind === 'integral').map((p) => p.amount_cents)),
    balance_received_cents: sum(payments.filter((p) => p.kind === 'saldo').map((p) => p.amount_cents)),
    pending_cents: sum(active.map((b) => Math.max(0, b.total_cents - b.paid_cents))),
    completed: bookings.filter((b) => b.status === 'concluido').length,
    canceled: bookings.filter((b) => b.status === 'cancelado').length,
    no_show: bookings.filter((b) => b.status === 'nao_compareceu').length,
    daily: group((d) => d), weekly: group(weekStart), monthly: group((d) => d.slice(0, 7)),
    top_services: [...sold.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    by_method: rank((p) => p.method),
    history: payments.map((p) => ({ ...p, service_name: byBooking.get(p.booking_id)?.service_name ?? '—' })).sort((a, b) => b.paid_at.localeCompare(a.paid_at)),
  };
}
