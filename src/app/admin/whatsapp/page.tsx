'use client';
import { useState } from 'react';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';

type N = { id: string; kind: string; to_phone: string; body: string | null; status: string; attempts: number; error: string | null; scheduled_for: string; sent_at: string | null; customers: { name: string } | null };
type R = { id: number; job: string; started_at: string; ok: boolean | null; detail: unknown; error: string | null };
const COLOR: Record<string, string> = { enviado: 'text-green-700', falhou: 'text-red-700', pendente: 'text-amber-700', cancelado: 'text-nude-700' };

export default function WhatsApp() {
  const { data, reload, error } = useApi<{ notifications: N[]; runs: R[] }>('/api/admin/notifications');
  const [m, setM] = useState({ phone: '', message: '' }), [msg, setMsg] = useState(''), [ok, setOk] = useState('');
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) { setMsg(''); setOk(''); try { const r = await fn(); r.ok ? setOk('Enviado.') : setMsg(r.error ?? 'Falhou'); } catch (e) { setMsg((e as Error).message); } reload(); }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold text-rose-600">WhatsApp — histórico e automações</h1>
      <p className="text-sm text-nude-700">As mensagens automáticas (confirmação, lembretes, lista de espera, retorno) são enviadas pelas tarefas agendadas do servidor, mesmo com o painel fechado. Ative/desative e ajuste os templates em Configurações.</p>
      <Msg error={msg || error} ok={ok} />
      <Card className="space-y-2"><h2 className="font-semibold">Mensagem manual</h2>
        <Field label="WhatsApp"><input className={inputCls} value={m.phone} onChange={(e) => setM({ ...m, phone: e.target.value })} inputMode="tel" /></Field>
        <Field label="Mensagem (texto livre só é entregue na janela de 24h do WhatsApp)"><textarea className={`${inputCls} h-20 py-2`} value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} /></Field>
        <Btn disabled={!m.phone || !m.message} onClick={() => run(() => api('/api/admin/notifications', { method: 'POST', json: m }))}>Enviar</Btn></Card>
      <Card><h2 className="mb-2 font-semibold">Mensagens</h2>
        <ul className="space-y-2 text-sm">{data?.notifications.map((n) => (
          <li key={n.id} className="border-b border-rose-50 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><span><b>{n.customers?.name ?? n.to_phone}</b> · {n.kind} · <span className={COLOR[n.status]}>{n.status}</span> · {new Date(n.sent_at ?? n.scheduled_for).toLocaleString('pt-BR')}</span>
              {['falhou', 'pendente'].includes(n.status) && <Btn variant="ghost" onClick={() => run(() => api('/api/admin/notifications', { method: 'POST', json: { resend: n.id } }))}>Reenviar</Btn>}</div>
            <p className="whitespace-pre-line text-xs text-nude-700">{n.body}</p>
            {n.error && <p className="text-xs text-red-700">Erro: {n.error}</p>}
          </li>))}
          {data?.notifications.length === 0 && <li className="text-nude-700">Nenhuma mensagem ainda.</li>}</ul></Card>
      <Card><h2 className="mb-2 font-semibold">Execuções das automações</h2>
        <ul className="space-y-1 text-xs">{data?.runs.map((r) => <li key={r.id} className={r.ok === false ? 'text-red-700' : ''}>{new Date(r.started_at).toLocaleString('pt-BR')} · {r.job} · {r.ok === null ? 'em andamento' : r.ok ? 'ok' : `erro: ${r.error}`} {r.ok && r.detail ? JSON.stringify(r.detail) : ''}</li>)}</ul></Card>
    </div>
  );
}
