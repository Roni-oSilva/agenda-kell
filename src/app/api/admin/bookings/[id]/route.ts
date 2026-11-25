import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { audit, db, handle, HttpError, requireAdmin } from '@/lib/server';
import { reschedule, setStatus } from '@/lib/booking';

const Body = z.object({
  status: z.enum(['aguardando_pagamento', 'aguardando_confirmacao', 'confirmado', 'em_atendimento', 'concluido', 'cancelado', 'nao_compareceu']).optional(),
  reason: z.string().max(300).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(500).optional(),
});

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const by = u.email ?? u.id;
  if (b.date && b.time) await reschedule(id, b.date, b.time, by);
  if (b.notes !== undefined) { await db().from('bookings').update({ notes: b.notes }).eq('id', id); await audit(by, 'editar_obs', 'booking', id); }
  // cancelamento pela profissional: registra a ocorrência; sem reembolso automático — a profissional resolve diretamente com a cliente
  if (b.status) await setStatus(id, b.status, { reason: b.status === 'cancelado' ? b.reason ?? 'cancelado pela profissional' : undefined, by });
  const { data } = await db().from('bookings').select('*, customers(id,name,phone_e164)').eq('id', id).single();
  return NextResponse.json({ booking: data });
});

// Excluir DE VEZ: só reservas já removidas e sem nenhum dinheiro recebido (o histórico financeiro nunca é apagado).
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const u = await requireAdmin();
  const { id } = await ctx.params;
  const { data: b } = await db().from('bookings').select('id,status,paid_cents,public_code,service_name,start_at').eq('id', id).maybeSingle();
  if (!b) throw new HttpError(404, 'Agendamento não encontrado');
  if (b.status !== 'cancelado') throw new HttpError(409, 'Primeiro remova o agendamento; só os removidos podem ser excluídos de vez.');
  const { count } = await db().from('payments').select('id', { count: 'exact', head: true }).eq('booking_id', id).eq('status', 'aprovado');
  if (b.paid_cents > 0 || (count ?? 0) > 0) throw new HttpError(409, 'Este agendamento tem pagamento recebido e precisa ficar no histórico financeiro.');
  const { error } = await db().from('bookings').delete().eq('id', id);
  if (error) throw error;
  await audit(u.email ?? u.id, 'excluir_agendamento', 'booking', id, { codigo: b.public_code, servico: b.service_name, inicio: b.start_at });
  return NextResponse.json({ ok: true });
});
