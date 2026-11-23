'use client';
import { useEffect, useState } from 'react';
import { api, Btn, Card, Field, inputCls, Msg, STATUS_LABEL, useApi } from '@/lib/client';
import { brl, fmtDateBR } from '@/lib/time';

type C = { id: string; name: string; phone_e164: string; visits: number; last_visit: string | null; next_booking: string | null; total_spent_cents: number };
type Detail = { customer: C; profile: Record<string, string | null> | null; bookings: { id: string; service_name: string; start_at: string; status: string; total_cents: number; paid_cents: number }[] };
const FIELDS: [string, string][] = [['nail_preferences', 'Preferências de unhas'], ['shape', 'Formato desejado'], ['length', 'Tamanho'], ['decoration', 'Preferências de decoração'], ['allergies', 'Alergias (informadas voluntariamente)'], ['notes', 'Observações']];

function Ficha({ id }: { id: string }) {
  const { data, reload } = useApi<Detail>(`/api/admin/customers/${id}`);
  const [p, setP] = useState<Record<string, string>>({}), [ok, setOk] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (data) setP(Object.fromEntries(FIELDS.map(([k]) => [k, data.profile?.[k] ?? '']))); }, [data]);
  if (!data) return <p className="text-sm">Carregando…</p>;
  return (
    <div className="space-y-3 border-t border-rose-100 pt-3">
      {FIELDS.map(([k, l]) => <Field key={k} label={l}><textarea className={`${inputCls} h-16 py-2`} value={p[k] ?? ''} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></Field>)}
      <Msg error={err} ok={ok} />
      <Btn onClick={async () => { setErr(''); setOk(''); try { await api(`/api/admin/customers/${id}`, { method: 'PATCH', json: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v || null])) }); setOk('Ficha salva.'); reload(); } catch (e) { setErr((e as Error).message); } }}>Salvar ficha</Btn>
      <h3 className="font-semibold">Histórico</h3>
      <ul className="space-y-1 text-sm">{data.bookings.map((b) => <li key={b.id}>{fmtDateBR(b.start_at)} · {b.service_name} · {STATUS_LABEL[b.status]} · {brl(b.paid_cents)}/{brl(b.total_cents)}</li>)}</ul>
    </div>
  );
}

export default function Clientes() {
  const [q, setQ] = useState(''), [qq, setQq] = useState(''), [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => setQq(q), 300); return () => clearTimeout(t); }, [q]);
  const { data, error } = useApi<{ customers: C[] }>(`/api/admin/customers?q=${encodeURIComponent(qq)}`);
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold text-rose-600">Clientes</h1>
      <input className={inputCls} placeholder="Buscar por nome ou WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} />
      <Msg error={error} />
      {data?.customers.map((c) => (
        <Card key={c.id} className="!p-3 text-sm">
          <button className="w-full text-left" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <b>{c.name}</b> · {c.phone_e164}<br />
            <span className="text-nude-700">{c.visits} visita(s) · último {c.last_visit ? fmtDateBR(c.last_visit) : '—'} · próximo {c.next_booking ? fmtDateBR(c.next_booking) : '—'} · total pago {brl(c.total_spent_cents)}</span>
          </button>
          {open === c.id && <Ficha id={c.id} />}
        </Card>
      ))}
      {data?.customers.length === 0 && <p className="text-sm text-nude-700">Nenhuma cliente encontrada.</p>}
    </div>
  );
}
