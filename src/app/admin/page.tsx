'use client';
import { useState } from 'react';
import { api, Btn, Card, Field, inputCls, METHOD_LABEL, Msg, STATUS_LABEL, useApi } from '@/lib/client';
import { addDays, brl, dateOfInstant, fmtTimeBR, todayBR, weekdayOf } from '@/lib/time';
import { shiftMonth } from '@/components/Calendar';

type B = { id: string; public_code: string; service_name: string; start_at: string; end_at: string; status: string; total_cents: number; paid_cents: number; deposit_cents: number; notes: string | null; customers: { id: string; name: string; phone_e164: string } };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STATUS_COLOR: Record<string, string> = { confirmado: 'bg-green-100 text-green-800', aguardando_pagamento: 'bg-amber-100 text-amber-800', aguardando_confirmacao: 'bg-amber-100 text-amber-800', em_atendimento: 'bg-blue-100 text-blue-800', concluido: 'bg-nude-100 text-nude-700', cancelado: 'bg-red-100 text-red-700', nao_compareceu: 'bg-red-100 text-red-700' };

function BookingRow({ b, reload }: { b: B; reload: () => void }) {
  const [open, setOpen] = useState(false), [msg, setMsg] = useState(''), [ok, setOk] = useState('');
  const [re, setRe] = useState({ date: dateOfInstant(b.start_at), time: fmtTimeBR(b.start_at) });
  const [pay, setPay] = useState({ method: 'pix', value: ((b.total_cents - b.paid_cents) / 100).toFixed(2) });
  const [reason, setReason] = useState('');
  const balance = b.total_cents - b.paid_cents;
  async function act(fn: () => Promise<unknown>, done: string) { setMsg(''); setOk(''); try { await fn(); setOk(done); reload(); } catch (e) { setMsg((e as Error).message); } }
  const patch = (json: object) => api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', json });
  return (
    <Card className="!p-3">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(!open)}>
        <span><b>{fmtTimeBR(b.start_at)}–{fmtTimeBR(b.end_at)}</b> · {b.customers.name} · {b.service_name}</span>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${STATUS_COLOR[b.status]}`}>{STATUS_LABEL[b.status]}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-rose-100 pt-3 text-sm">
          <p>WhatsApp: <a className="text-rose-600 underline" href={`https://wa.me/${b.customers.phone_e164}`} target="_blank" rel="noreferrer">{b.customers.phone_e164}</a> · Código {b.public_code}</p>
          <p>Total {brl(b.total_cents)} · Sinal {brl(b.deposit_cents)} · Recebido {brl(b.paid_cents)} · <b>Saldo {brl(balance)}</b></p>
          <div className="flex flex-wrap gap-2">
            <select className={`${inputCls} !w-auto`} value={b.status} onChange={(e) => e.target.value !== 'cancelado' && act(() => patch({ status: e.target.value }), 'Status atualizado.')}>
              {Object.entries(STATUS_LABEL).filter(([k]) => k !== 'cancelado' || b.status === 'cancelado').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {balance > 0 && !['cancelado'].includes(b.status) && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Registrar pagamento do saldo"><input className={`${inputCls} !w-28`} value={pay.value} onChange={(e) => setPay({ ...pay, value: e.target.value })} inputMode="decimal" /></Field>
              <select className={`${inputCls} !w-auto`} value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <Btn onClick={() => act(() => api(`/api/admin/bookings/${b.id}/payments`, { method: 'POST', json: { method: pay.method, amount_cents: Math.round(parseFloat(pay.value.replace(',', '.')) * 100) } }), 'Pagamento registrado.')}>Registrar</Btn>
            </div>)}
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Reagendar"><input type="date" className={`${inputCls} !w-40`} value={re.date} onChange={(e) => setRe({ ...re, date: e.target.value })} /></Field>
            <input type="time" className={`${inputCls} !w-28`} value={re.time} onChange={(e) => setRe({ ...re, time: e.target.value })} />
            <Btn variant="ghost" onClick={() => act(() => patch(re), 'Reagendado.')}>Reagendar</Btn>
          </div>
          {!['cancelado', 'concluido'].includes(b.status) && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Cancelar (registrar motivo)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" /></Field>
              <Btn variant="danger" disabled={reason.length < 3} onClick={() => confirm('Cancelar este agendamento? O histórico financeiro será mantido.') && act(() => patch({ status: 'cancelado', reason }), 'Cancelado e registrado.')}>Cancelar</Btn>
            </div>)}
          <Msg error={msg} ok={ok} />
        </div>
      )}
    </Card>
  );
}

function NewBooking({ done }: { done: () => void }) {
  const { data } = useApi<{ services: { id: string; name: string }[] }>('/api/admin/services');
  const [f, setF] = useState({ serviceId: '', date: todayBR(), time: '09:00', name: '', phone: '', notes: '' });
  const [msg, setMsg] = useState('');
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-semibold">Novo atendimento manual</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Procedimento"><select className={inputCls} value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}><option value="">Selecione…</option>{data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="flex gap-2"><Field label="Data"><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><Field label="Hora"><input type="time" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field></div>
        <Field label="Nome"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="WhatsApp"><input className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Msg error={msg} />
      <Btn onClick={async () => { setMsg(''); try { await api('/api/admin/bookings', { method: 'POST', json: f }); setF({ ...f, name: '', phone: '' }); done(); } catch (e) { setMsg((e as Error).message); } }}>Adicionar</Btn>
    </Card>
  );
}

export default function Agenda() {
  const [view, setView] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [day, setDay] = useState(todayBR());
  const [showNew, setShowNew] = useState(false);
  const mon = addDays(day, -((weekdayOf(day) + 6) % 7));
  const month = day.slice(0, 7);
  const range = view === 'dia' ? [day, day] : view === 'semana' ? [mon, addDays(mon, 6)] : [`${month}-01`, addDays(`${shiftMonth(month, 1)}-01`, -1)];
  const { data, error, reload } = useApi<{ bookings: B[] }>(`/api/admin/bookings?from=${range[0]}&to=${range[1]}`);
  const list = data?.bookings ?? [];
  const step = (n: number) => setDay(view === 'mes' ? `${shiftMonth(month, n)}-01` : addDays(day, n * (view === 'semana' ? 7 : 1)));
  const byDay = (d: string) => list.filter((b) => dateOfInstant(b.start_at) === d);
  const days = view === 'semana' ? Array.from({ length: 7 }, (_, i) => addDays(mon, i)) : [day];

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2">
        {(['dia', 'semana', 'mes'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`min-h-11 rounded-full px-4 text-sm ${view === v ? 'bg-rose-500 text-white' : 'border border-rose-200 text-rose-700'}`}>{v === 'mes' ? 'Mês' : v[0].toUpperCase() + v.slice(1)}</button>)}
        <Btn variant="ghost" onClick={() => step(-1)}>‹</Btn><input type="date" className={`${inputCls} !w-40`} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /><Btn variant="ghost" onClick={() => step(1)}>›</Btn>
        <Btn variant="ghost" onClick={() => setDay(todayBR())}>Hoje</Btn>
        <Btn className="ml-auto" onClick={() => setShowNew(!showNew)}>+ Atendimento</Btn>
      </Card>
      {showNew && <NewBooking done={() => { reload(); setShowNew(false); }} />}
      <Msg error={error} />
      {view === 'mes' ? (
        <Card><div className="grid grid-cols-7 gap-1 text-center text-xs">
          {WD.map((w) => <div key={w} className="text-nude-700">{w}</div>)}
          {Array(weekdayOf(`${month}-01`)).fill(0).map((_, i) => <div key={`b${i}`} />)}
          {Array.from({ length: +range[1].slice(8) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).map((d) => {
            const n = byDay(d).filter((b) => !['cancelado', 'nao_compareceu'].includes(b.status)).length;
            return <button key={d} onClick={() => { setDay(d); setView('dia'); }} className={`min-h-14 rounded-xl border p-1 ${n ? 'border-rose-300 bg-rose-50' : 'border-nude-100'} ${d === todayBR() ? 'ring-2 ring-rose-400' : ''}`}><div>{+d.slice(8)}</div>{n > 0 && <div className="text-rose-600">{n} atend.</div>}</button>;
          })}
        </div></Card>
      ) : days.map((d) => (
        <section key={d} className="space-y-2">
          {view === 'semana' && <h2 className="text-sm font-semibold">{WD[weekdayOf(d)]} {d.split('-').reverse().join('/')}</h2>}
          {byDay(d).length === 0 ? <p className="text-sm text-nude-700">Sem atendimentos.</p> : byDay(d).map((b) => <BookingRow key={b.id} b={b} reload={reload} />)}
        </section>
      ))}
    </div>
  );
}
