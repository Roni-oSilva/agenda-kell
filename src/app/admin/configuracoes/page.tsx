'use client';
import { useEffect, useState } from 'react';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';

type S = {
  studio: { name: string; whatsapp_contact: string };
  booking: { slot_step_min: number; min_notice_hours: number; max_days_ahead: number; hold_minutes: number; pix_expiration_minutes: number; max_installments: number };
  payment_methods: { pix: boolean; card: boolean; cash: boolean };
  policy: { text: string };
  whatsapp: { enabled: boolean; confirmation: boolean; reminder_24h: boolean; reminder_2h: boolean; waitlist: boolean; followup: boolean; language: string; templates: Record<string, string> };
};
const BOOK: [keyof S['booking'], string][] = [['slot_step_min', 'Intervalo entre horários (min)'], ['min_notice_hours', 'Antecedência mínima (horas)'], ['max_days_ahead', 'Limite de dias futuros'], ['hold_minutes', 'Reserva temporária (min)'], ['pix_expiration_minutes', 'Validade do PIX (min, mín. 30)'], ['max_installments', 'Parcelas máximas no cartão']];
const TOGGLES: [keyof S['whatsapp'], string][] = [['enabled', 'Automações de WhatsApp ativas'], ['confirmation', 'Confirmação de agendamento'], ['reminder_24h', 'Lembrete 24h antes'], ['reminder_2h', 'Lembrete 2h antes'], ['waitlist', 'Aviso de vaga (lista de espera)'], ['followup', 'Convite de retorno/manutenção']];

export default function Config() {
  const { data, error } = useApi<{ settings: S; integrations: Record<string, boolean> }>('/api/admin/settings');
  const [s, setS] = useState<S | null>(null), [msg, setMsg] = useState(''), [ok, setOk] = useState('');
  useEffect(() => { if (data) setS(data.settings); }, [data]);
  if (!s) return <Msg error={error} />;
  const save = async (key: keyof S) => { setMsg(''); setOk(''); try { await api('/api/admin/settings', { method: 'PUT', json: { key, value: s[key] } }); setOk('Salvo.'); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold text-rose-600">Configurações</h1>
      <Msg error={msg} ok={ok} />
      <Card className="space-y-2"><h2 className="font-semibold">Integrações (credenciais ficam só no servidor)</h2>
        <ul className="space-y-1 text-sm">{data && Object.entries(data.integrations).map(([k, v]) => <li key={k} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${v ? 'bg-emerald-500' : 'bg-amber-400'}`} />{k}: {v ? 'configurado' : 'pendente'}</li>)}</ul></Card>
      <Card className="space-y-3"><h2 className="font-semibold">Estúdio</h2>
        <Field label="Nome"><input className={inputCls} value={s.studio.name} onChange={(e) => setS({ ...s, studio: { ...s.studio, name: e.target.value } })} /></Field>
        <Field label="WhatsApp de contato (mostrado à cliente)"><input className={inputCls} inputMode="tel" value={s.studio.whatsapp_contact} onChange={(e) => setS({ ...s, studio: { ...s.studio, whatsapp_contact: e.target.value } })} /></Field>
        <Btn onClick={() => save('studio')}>Salvar</Btn></Card>
      <Card className="space-y-3"><h2 className="font-semibold">Regras de agendamento</h2>
        <div className="grid gap-3 sm:grid-cols-2">{BOOK.map(([k, l]) => <Field key={k} label={l}><input type="number" className={inputCls} value={s.booking[k]} onChange={(e) => setS({ ...s, booking: { ...s.booking, [k]: +e.target.value } })} /></Field>)}</div>
        <Btn onClick={() => save('booking')}>Salvar</Btn></Card>
      <Card className="space-y-3"><h2 className="font-semibold">Formas de pagamento disponíveis</h2>
        {([['pix', 'PIX'], ['card', 'Cartão de crédito/débito'], ['cash', 'Dinheiro presencial']] as const).map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={s.payment_methods[k]} onChange={(e) => setS({ ...s, payment_methods: { ...s.payment_methods, [k]: e.target.checked } })} />{l}</label>)}
        <Btn onClick={() => save('payment_methods')}>Salvar</Btn></Card>
      <Card className="space-y-3"><h2 className="font-semibold">Política de cancelamento (exibida e aceita antes do pagamento)</h2>
        <textarea className={`${inputCls} h-32 py-2`} value={s.policy.text} onChange={(e) => setS({ ...s, policy: { text: e.target.value } })} />
        <Btn onClick={() => save('policy')}>Salvar</Btn></Card>
      <Card className="space-y-3"><h2 className="font-semibold">WhatsApp</h2>
        {TOGGLES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={s.whatsapp[k] as boolean} onChange={(e) => setS({ ...s, whatsapp: { ...s.whatsapp, [k]: e.target.checked } })} />{l}</label>)}
        <p className="text-xs text-nude-700">Nomes dos templates aprovados na Meta (mensagens iniciadas pela empresa exigem template aprovado). O texto exato é definido no template; ordem dos parâmetros descrita no README.</p>
        {Object.entries(s.whatsapp.templates).map(([k, v]) => <Field key={k} label={`Template: ${k}`}><input className={inputCls} value={v} onChange={(e) => setS({ ...s, whatsapp: { ...s.whatsapp, templates: { ...s.whatsapp.templates, [k]: e.target.value } } })} /></Field>)}
        <Btn onClick={() => save('whatsapp')}>Salvar</Btn></Card>
      <Card><h2 className="mb-2 font-semibold">Backup</h2><a className="text-rose-600 underline" href="/api/admin/backup">Baixar backup completo (JSON)</a></Card>
    </div>
  );
}
