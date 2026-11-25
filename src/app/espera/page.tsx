'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';
import { isSunday } from '@/lib/time';

function Form() {
  const qs = useSearchParams();
  const { data } = useApi<{ services: { id: string; name: string }[] }>('/api/services');
  const [f, setF] = useState({ name: '', phone: '', serviceId: qs.get('servico') ?? '', dates: qs.get('data') ? [qs.get('data')!] : [''], periods: [] as string[], consent: false });
  const [err, setErr] = useState(''), [done, setDone] = useState(false), [busy, setBusy] = useState(false);
  const toggle = (p: string) => setF((x) => ({ ...x, periods: x.periods.includes(p) ? x.periods.filter((y) => y !== p) : [...x.periods, p] }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/waitlist', { method: 'POST', json: { ...f, dates: f.dates.filter(Boolean) } }); setDone(true); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  if (done) return <main className="mx-auto max-w-xl p-6"><Card className="animate-slideUp space-y-2"><h1 className="text-3xl font-semibold text-rose-600">Você está na lista de espera</h1><p className="text-sm">Se surgir uma vaga compatível, avisaremos pelo WhatsApp. A reserva só acontece se você confirmar.</p><Link href="/" className="text-rose-600 underline">Voltar</Link></Card></main>;
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-rose-600">‹ Início</Link>
      <div className="animate-fadeUp text-center"><h1 className="text-4xl font-semibold text-rose-600">Lista de espera</h1><div className="gold-line mx-auto mt-3 w-24" /><p className="mt-3 text-sm text-nude-700">Avisamos pelo WhatsApp quando surgir uma vaga. Você decide se quer reservar.</p></div>
      <form onSubmit={submit} className="animate-slideUp"><Card className="space-y-3">
        <Field label="Nome completo"><input required minLength={3} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="WhatsApp (com DDD)"><input required inputMode="tel" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Procedimento"><select required className={inputCls} value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}><option value="">Selecione…</option>{data?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="space-y-2"><span className="block text-sm font-medium text-nude-700">Datas preferidas</span>
          {f.dates.map((d, i) => <input key={i} type="date" required={i === 0} className={inputCls} value={d} onChange={(e) => { const v = e.target.value; if (v && isSunday(v)) { setErr('Não atendemos aos domingos. Escolha outra data.'); return; } setErr(''); setF({ ...f, dates: f.dates.map((x, j) => (j === i ? v : x)) }); }} />)}
          {f.dates.length < 10 && <Btn type="button" variant="ghost" onClick={() => setF({ ...f, dates: [...f.dates, ''] })}>+ outra data</Btn>}</div>
        <div><span className="mb-1 block text-sm font-medium text-nude-700">Períodos preferidos</span>
          <div className="flex gap-2">{[['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite']].map(([k, l]) => <button key={k} type="button" onClick={() => toggle(k)} className={`min-h-11 flex-1 rounded-xl border text-sm ${f.periods.includes(k) ? 'border-rose-500 bg-rose-500 text-white' : 'border-rose-200 text-rose-700'}`}>{l}</button>)}</div></div>
        <label className="flex gap-2 text-sm"><input required type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-1 h-5 w-5" />Autorizo ser avisada por WhatsApp quando surgir uma vaga.</label>
        <Msg error={err} />
        <Btn type="submit" disabled={busy || f.periods.length === 0} className="w-full">Entrar na lista</Btn>
      </Card></form>
    </main>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
