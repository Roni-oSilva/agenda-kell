'use client';
import { useState } from 'react';
import { Card, inputCls, METHOD_LABEL, Msg, useApi, Field } from '@/lib/client';
import { addDays, brl, fmtDateBR, todayBR } from '@/lib/time';

type Row = { period: string; cents: number };
type F = {
  received_cents: number; expected_cents: number; deposits_cents: number; full_payments_cents: number; balance_received_cents: number; pending_cents: number; completed: number; canceled: number; no_show: number;
  daily: Row[]; weekly: Row[]; monthly: Row[]; top_services: { name: string; count: number }[]; by_method: { name: string; count: number; cents: number }[];
  history: { booking_id: string; method: string; kind: string; amount_cents: number; paid_at: string; service_name: string }[];
};
const Kpi = ({ l, v, hint }: { l: string; v: string; hint?: string }) => <Card className="!p-3"><p className="text-xs text-nude-700">{l}</p><p className="text-xl font-semibold text-rose-600">{v}</p>{hint && <p className="text-xs text-nude-700">{hint}</p>}</Card>;
const Table = ({ rows, label }: { rows: Row[]; label: (p: string) => string }) => <ul className="space-y-1 text-sm">{rows.length ? rows.map((r) => <li key={r.period} className="flex justify-between"><span>{label(r.period)}</span><b>{brl(r.cents)}</b></li>) : <li className="text-nude-700">Sem recebimentos no período.</li>}</ul>;

export default function Financeiro() {
  const [f, setF] = useState({ from: addDays(todayBR(), -30), to: todayBR(), service: '', method: '' });
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data: d, error } = useApi<F>(`/api/admin/finance?${qs}`);
  const { data: sv } = useApi<{ services: { name: string }[] }>('/api/admin/services');
  const br = (p: string) => p.length === 7 ? p.split('-').reverse().join('/') : p.split('-').reverse().join('/');
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-semibold text-rose-600">Financeiro</h1>
      <Card className="flex flex-wrap items-end gap-2">
        <Field label="De"><input type="date" className={inputCls} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Até"><input type="date" className={inputCls} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Procedimento"><select className={inputCls} value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">Todos</option>{sv?.services.map((s) => <option key={s.name}>{s.name}</option>)}</select></Field>
        <Field label="Forma de pagamento"><select className={inputCls} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="">Todas</option>{Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </Card>
      <Msg error={error} />
      {d && (<>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi l="Total recebido (efetivo)" v={brl(d.received_cents)} hint="pagamentos aprovados no período" />
          <Kpi l="Faturamento previsto" v={brl(d.expected_cents)} hint="atendimentos do período, exceto cancelados" />
          <Kpi l="Valores pendentes" v={brl(d.pending_cents)} hint="saldo a receber" />
          <Kpi l="Sinais recebidos" v={brl(d.deposits_cents)} />
          <Kpi l="Pagamentos integrais" v={brl(d.full_payments_cents)} />
          <Kpi l="Saldos recebidos" v={brl(d.balance_received_cents)} />
          <Kpi l="Concluídos" v={String(d.completed)} />
          <Kpi l="Cancelados / faltas" v={`${d.canceled} / ${d.no_show}`} />
        </div>
        <Card><div className="mb-2 flex gap-2">{(['daily', 'weekly', 'monthly'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`min-h-11 rounded-full px-4 text-sm ${tab === t ? 'bg-rose-500 text-white' : 'border border-rose-200 text-rose-700'}`}>{{ daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' }[t]}</button>)}</div>
          <Table rows={d[tab]} label={(p) => (tab === 'weekly' ? `Semana de ${br(p)}` : br(p))} /></Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Card><h2 className="mb-2 font-semibold">Procedimentos mais vendidos</h2><ul className="space-y-1 text-sm">{d.top_services.map((s) => <li key={s.name} className="flex justify-between"><span>{s.name}</span><b>{s.count}</b></li>)}</ul></Card>
          <Card><h2 className="mb-2 font-semibold">Formas de pagamento</h2><ul className="space-y-1 text-sm">{d.by_method.map((m) => <li key={m.name} className="flex justify-between"><span>{METHOD_LABEL[m.name] ?? m.name} ({m.count})</span><b>{brl(m.cents)}</b></li>)}</ul></Card>
        </div>
        <Card><h2 className="mb-2 font-semibold">Histórico de recebimentos</h2>
          <ul className="space-y-1 text-sm">{d.history.map((h, i) => <li key={i} className="flex justify-between gap-2"><span>{fmtDateBR(h.paid_at)} · {h.service_name} · {METHOD_LABEL[h.method]} · {h.kind}</span><b>{brl(h.amount_cents)}</b></li>)}</ul></Card>
      </>)}
    </div>
  );
}
