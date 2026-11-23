'use client';
import { useState } from 'react';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';
import { brl } from '@/lib/time';

type S = { id?: string; name: string; category: string; description: string; image_url: string; price_cents: number; duration_min: number; active: boolean; deposit_mode: string; deposit_value: number; deposit_required: boolean; return_days: number | null; sort_order: number };
const EMPTY: S = { name: '', category: 'Outros', description: '', image_url: '', price_cents: 0, duration_min: 60, active: true, deposit_mode: 'none', deposit_value: 0, deposit_required: false, return_days: null, sort_order: 0 };

function Editor({ init, done }: { init: S; done: () => void }) {
  const [s, setS] = useState<S>({ ...init, description: init.description ?? '', image_url: init.image_url ?? '' });
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const money = s.deposit_mode === 'percent' ? s.deposit_value : s.deposit_value / 100;
  async function upload(f?: File) {
    if (!f) return; const fd = new FormData(); fd.append('file', f); setMsg('');
    try { const r = await fetch('/api/admin/upload', { method: 'POST', body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setS((x) => ({ ...x, image_url: j.url })); } catch (e) { setMsg((e as Error).message); }
  }
  async function save() {
    setBusy(true); setMsg('');
    try { await api('/api/admin/services', { method: s.id ? 'PATCH' : 'POST', json: { ...s, description: s.description || null, image_url: s.image_url || null } }); done(); } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }
  return (
    <Card className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input className={inputCls} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
        <Field label="Categoria (agrupa no catálogo)"><input list="cats" className={inputCls} value={s.category} onChange={(e) => setS({ ...s, category: e.target.value })} /><datalist id="cats"><option value="Alongamentos" /><option value="Manutenção" /><option value="Extras" /><option value="Outros" /></datalist></Field>
        <Field label="Duração (min)"><input type="number" className={inputCls} value={s.duration_min} onChange={(e) => setS({ ...s, duration_min: +e.target.value })} /></Field>
        <Field label="Preço (R$)"><input inputMode="decimal" className={inputCls} defaultValue={(s.price_cents / 100).toFixed(2)} onBlur={(e) => setS({ ...s, price_cents: Math.round(parseFloat(e.target.value.replace(',', '.')) * 100) || 0 })} /></Field>
        <Field label="Retorno/manutenção sugerido (dias)"><input type="number" className={inputCls} value={s.return_days ?? ''} onChange={(e) => setS({ ...s, return_days: e.target.value ? +e.target.value : null })} /></Field>
        <Field label="Sinal"><select className={inputCls} value={s.deposit_mode} onChange={(e) => setS({ ...s, deposit_mode: e.target.value })}><option value="none">Sem sinal</option><option value="fixed">Valor fixo</option><option value="percent">Percentual</option><option value="full">Pagamento integral</option></select></Field>
        {(s.deposit_mode === 'fixed' || s.deposit_mode === 'percent') && <Field label={s.deposit_mode === 'percent' ? 'Percentual (%)' : 'Valor do sinal (R$)'}><input inputMode="decimal" className={inputCls} defaultValue={money} onBlur={(e) => { const v = parseFloat(e.target.value.replace(',', '.')) || 0; setS({ ...s, deposit_value: s.deposit_mode === 'percent' ? Math.round(v) : Math.round(v * 100) }); }} /></Field>}
      </div>
      <Field label="Descrição"><textarea className={`${inputCls} h-20 py-2`} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></Field>
      <Field label="Fotografia">
        {s.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.image_url} alt="" className="mb-2 h-24 rounded-xl object-cover" />}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload(e.target.files?.[0])} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={s.deposit_required} onChange={(e) => setS({ ...s, deposit_required: e.target.checked })} />Sinal obrigatório para garantir o horário</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} />Disponível para agendamento</label>
      </div>
      <Msg error={msg} />
      <div className="flex gap-2"><Btn disabled={busy || s.name.length < 2} onClick={save}>Salvar</Btn><Btn variant="ghost" onClick={done}>Fechar</Btn></div>
    </Card>
  );
}

export default function Servicos() {
  const { data, reload, error } = useApi<{ services: S[] }>('/api/admin/services');
  const [edit, setEdit] = useState<S | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h1 className="text-3xl font-semibold text-rose-600">Procedimentos</h1><Btn onClick={() => setEdit(EMPTY)}>+ Novo</Btn></div>
      <Msg error={error} />
      {edit && <Editor key={edit.id ?? 'new'} init={edit} done={() => { setEdit(null); reload(); }} />}
      {data?.services.map((s) => (
        <Card key={s.id} className="flex flex-wrap items-center justify-between gap-2 !p-3 text-sm">
          <span><b>{s.name}</b> · {s.category} · {brl(s.price_cents)} · {s.duration_min} min{s.deposit_mode !== 'none' ? ` · sinal ${s.deposit_mode === 'percent' ? s.deposit_value + '%' : s.deposit_mode === 'full' ? 'integral' : brl(s.deposit_value)}${s.deposit_required ? ' (obrigatório)' : ' (opcional)'}` : ''}{!s.active && ' · desativado'}</span>
          <span className="flex gap-2">
            <Btn variant="ghost" onClick={() => setEdit(s)}>Editar</Btn>
            <Btn variant="ghost" onClick={async () => { await api('/api/admin/services', { method: 'PATCH', json: { ...s, active: !s.active } }); reload(); }}>{s.active ? 'Desativar' : 'Ativar'}</Btn>
            <Btn variant="danger" onClick={async () => { if (confirm(`Excluir "${s.name}"? Agendamentos antigos mantêm nome e preço.`)) { await api(`/api/admin/services?id=${s.id}`, { method: 'DELETE' }); reload(); } }}>Excluir</Btn>
          </span>
        </Card>
      ))}
    </div>
  );
}
