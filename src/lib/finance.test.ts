import { describe, expect, it } from 'vitest';
import { summarize } from './finance';

describe('finance', () => {
  it('separa recebido de previsto e mantém sinal de cancelados', () => {
    const bookings = [
      { id: 'a', service_name: 'Gel', customer_id: 'c1', status: 'confirmado', total_cents: 15000, paid_cents: 3000, start_at: '2026-11-23T17:00:00Z' },
      { id: 'b', service_name: 'Gel', customer_id: 'c2', status: 'cancelado', total_cents: 15000, paid_cents: 3000, start_at: '2026-11-24T17:00:00Z' },
      { id: 'c', service_name: 'Blindagem', customer_id: 'c3', status: 'concluido', total_cents: 9000, paid_cents: 9000, start_at: '2026-11-22T17:00:00Z' },
    ];
    const payments = [
      { booking_id: 'a', method: 'pix', kind: 'sinal', amount_cents: 3000, paid_at: '2026-11-20T15:00:00Z' },
      { booking_id: 'b', method: 'credit_card', kind: 'sinal', amount_cents: 3000, paid_at: '2026-11-20T16:00:00Z' },
      { booking_id: 'c', method: 'cash', kind: 'integral', amount_cents: 9000, paid_at: '2026-11-22T20:00:00Z' },
    ];
    const s = summarize(payments, bookings);
    expect(s.received_cents).toBe(15000);
    expect(s.expected_cents).toBe(24000);   // cancelado fora do previsto
    expect(s.pending_cents).toBe(12000);    // 150 - 30 do agendamento confirmado
    expect(s.deposits_cents).toBe(6000);
    expect(s.full_payments_cents).toBe(9000);
    expect(s.canceled).toBe(1);
    expect(s.completed).toBe(1);
    expect(s.top_services[0]).toEqual({ name: 'Gel', count: 1 });
    expect(s.daily[0]).toEqual({ period: '2026-11-20', cents: 6000 });
    expect(s.monthly).toEqual([{ period: '2026-11', cents: 15000 }]);
  });
});
