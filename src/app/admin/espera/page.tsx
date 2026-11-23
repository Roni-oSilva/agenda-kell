'use client';
import { api, Btn, Card, Msg, useApi } from '@/lib/client';

type W = { id: string; name: string; phone_e164: string; preferred_dates: string[]; periods: string[]; status: string; notified_for: string | null; services: { name: string } | null };

export default function Espera() {
  const { data, reload, error } = useApi<{ waitlist: W[] }>('/api/admin/waitlist');
  const set = async (id: string, status: string) => { await api('/api/admin/waitlist', { method: 'PATCH', json: { id, status } }); reload(); };
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold text-rose-600">Lista de espera</h1>
      <p className="text-sm text-nude-700">Quando surge vaga compatível, a cliente recebe um aviso por WhatsApp e precisa confirmar sozinha pelo link — nada é reservado automaticamente.</p>
      <Msg error={error} />
      {data?.waitlist.map((w) => (
        <Card key={w.id} className="flex flex-wrap items-center justify-between gap-2 !p-3 text-sm">
          <span><b>{w.name}</b> · <a className="text-rose-600 underline" href={`https://wa.me/${w.phone_e164}`} target="_blank" rel="noreferrer">{w.phone_e164}</a> · {w.services?.name}<br />Datas: {w.preferred_dates.map((d) => d.split('-').reverse().join('/')).join(', ')} · {w.periods.join(', ')} · <b>{w.status}</b></span>
          <span className="flex gap-2">{w.status !== 'atendida' && <Btn variant="ghost" onClick={() => set(w.id, 'atendida')}>Atendida</Btn>}{w.status !== 'cancelada' && <Btn variant="danger" onClick={() => set(w.id, 'cancelada')}>Remover</Btn>}</span>
        </Card>
      ))}
      {data?.waitlist.length === 0 && <p className="text-sm text-nude-700">Ninguém na lista.</p>}
    </div>
  );
}
