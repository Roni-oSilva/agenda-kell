'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Calendar, { type DayInfo } from '@/components/Calendar';
import { IconBack, IconCalendar, IconCard, IconCheck, IconClock, IconUser } from '@/components/Icons';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';
import { brl, todayBR } from '@/lib/time';

type Svc = { id: string; name: string; category: string; description: string | null; price_cents: number; deposit_required: boolean; deposit_cents: number };
type Info = { services: Svc[]; policy: string };
const STEPS = [['Procedimento', IconCard], ['Data e horário', IconCalendar], ['Seus dados', IconUser]] as const;
const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const longDate = (d: string) => `${WD[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${d.split('-').reverse().join('/')}`;

function Stepper({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <ol className="mb-7 flex items-start" aria-label="Etapas do agendamento">
      {STEPS.map(([label, Icon], i) => {
        const done = i < step, cur = i === step;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center">
            {i > 0 && <span className="absolute right-1/2 top-5 h-0.5 w-full overflow-hidden rounded bg-rose-100"><span className={`block h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700 ${i <= step ? 'w-full' : 'w-0'}`} /></span>}
            <button type="button" disabled={!done} onClick={() => onGo(i)} aria-current={cur ? 'step' : undefined}
              className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 transition duration-500 ${done ? 'cursor-pointer border-rose-600 bg-rose-600 text-white hover:scale-110' : cur ? 'animate-pulseRing border-rose-600 bg-white text-rose-600' : 'border-rose-200 bg-white text-rose-200'}`}>
              {done ? <IconCheck width={18} height={18} /> : <Icon width={18} height={18} />}
            </button>
            <span className={`mt-2 text-center text-[11px] font-medium uppercase tracking-wider transition-colors ${cur ? 'text-rose-600' : done ? 'text-rose-500' : 'text-nude-700/50'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Wizard() {
  const router = useRouter(), qs = useSearchParams();
  const { data: info } = useApi<Info>('/api/services');
  const [serviceId, setServiceId] = useState(qs.get('servico') ?? '');
  const [step, setStep] = useState(qs.get('servico') ? 1 : 0);
  const [month, setMonth] = useState((qs.get('data') ?? todayBR()).slice(0, 7));
  const [date, setDate] = useState<string | null>(qs.get('data'));
  const [time, setTime] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', phone: '', consent: true, policy: false, website: '' });
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const timesRef = useRef<HTMLDivElement>(null);

  const svc = info?.services.find((s) => s.id === serviceId);
  const cal = useApi<{ days: Record<string, DayInfo> }>(serviceId ? `/api/availability?service=${serviceId}&month=${month}` : null);
  const slots = useApi<{ slots: string[]; taken: string[]; status: string }>(serviceId && date ? `/api/availability?service=${serviceId}&date=${date}` : null);
  const monthHasSlots = cal.data ? Object.values(cal.data.days).some((d) => d.status === 'available') : true;
  const groups = (info?.services ?? []).reduce<Record<string, Svc[]>>((a, s) => ((a[s.category] ??= []).push(s), a), {});
  const times = slots.data ? [...slots.data.slots.map((t) => ({ t, free: true })), ...slots.data.taken.map((t) => ({ t, free: false }))].sort((a, b) => a.t.localeCompare(b.t)) : null;

  useEffect(() => { if (date && timesRef.current) setTimeout(() => timesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150); }, [date]);

  function pick(id: string) {
    setServiceId(id); setDate(null); setTime(null); setErr('');
    setTimeout(() => setStep(1), 380); // deixa a animação de seleção terminar
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const r = await api<{ code: string }>('/api/bookings', { method: 'POST', json: { serviceId, date, time, name: f.name, phone: f.phone, consent: f.consent, policyAccepted: f.policy, website: f.website } });
      router.push(`/agendamento/${r.code}`);
    } catch (e) {
      setErr((e as Error).message); setTime(null); setStep(1); cal.reload(); slots.reload(); setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-8">
      <header className="mb-6 animate-fadeUp text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo" className="mx-auto mb-2 h-36 w-auto animate-pop object-contain mix-blend-multiply" />
        <h1 className="text-5xl font-semibold text-rose-600">Agendar horário</h1>
        <div className="gold-line mx-auto mt-3 w-28" />
        <p className="mt-3 text-sm text-nude-700">Escolha o procedimento, o dia e o horário. Não precisa criar conta.</p>
      </header>
      <Stepper step={step} onGo={(i) => { setErr(''); setStep(i); }} />

      <div key={step} className="animate-slideX">
        {step === 0 && (
          <div className="space-y-6">
            {!info && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-skeleton rounded-3xl bg-white/70" />)}</div>}
            {info && info.services.length === 0 && <Card className="text-center text-sm text-nude-700">Nenhum procedimento disponível no momento.</Card>}
            {Object.entries(groups).map(([cat, list]) => (
              <section key={cat}>
                <div className="mb-3 flex items-center gap-3"><span className="rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-1 text-[11px] font-semibold uppercase tracking-[.22em] text-white shadow">{cat}</span><span className="gold-line flex-1" /></div>
                <ul className="space-y-3">
                  {list.map((s, i) => {
                    const on = s.id === serviceId;
                    return (
                      <li key={s.id} className="animate-fadeUp" style={{ animationDelay: `${i * 60}ms` }}>
                        <button type="button" onClick={() => pick(s.id)} aria-pressed={on}
                          className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border-2 bg-white/90 p-4 text-left shadow-glass transition duration-300 hover:-translate-y-1 hover:shadow-lift ${on ? 'border-rose-500 ring-4 ring-rose-100' : 'border-transparent hover:border-rose-200'}`}>
                          <span className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-rose-500 to-ouro transition-transform duration-500 ${on ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`} />
                          <span className="min-w-0 flex-1 pl-1">
                            <span className="block font-display text-2xl font-semibold leading-tight text-rose-600">{s.name}</span>
                            {s.description && <span className="mt-0.5 block text-sm text-nude-700">{s.description}</span>}
                            {s.deposit_required && s.deposit_cents > 0 && <span className="mt-1.5 inline-block rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-600">Sinal de {brl(s.deposit_cents)}</span>}
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1.5">
                            <span className="font-display text-2xl font-semibold text-rose-600">{brl(s.price_cents)}</span>
                            <span className={`grid h-7 w-7 place-items-center rounded-full border-2 transition duration-300 ${on ? 'scale-110 border-rose-600 bg-rose-600 text-white' : 'border-rose-200 text-transparent group-hover:border-rose-400'}`}><IconCheck width={14} height={14} /></span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {step === 1 && svc && (
          <div className="space-y-4">
            <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1 text-sm text-rose-600 transition hover:gap-2"><IconBack />Trocar procedimento</button>
            <Card className="flex items-center justify-between gap-3 !py-3"><span className="font-display text-xl font-semibold text-rose-600">{svc.name}</span><span className="text-sm font-medium text-nude-700">{brl(svc.price_cents)}</span></Card>
            <Card>
              <h2 className="mb-3 text-3xl font-semibold text-rose-600">Escolha o dia</h2>
              <Calendar month={month} days={cal.data?.days ?? null} selected={date} onSelect={(d) => { setDate(d); setTime(null); }} onMonth={setMonth} />
              {cal.data && !monthHasSlots && <p className="mt-3 text-sm">Sem horários neste mês. <Link className="text-rose-600 underline" href={`/espera?servico=${serviceId}`}>Entrar na lista de espera</Link></p>}
            </Card>
            {date && (
              <div ref={timesRef} className="animate-slideUp">
                <Card>
                  <h2 className="text-3xl font-semibold text-rose-600">Escolha o horário</h2>
                  <p className="mb-3 text-sm capitalize text-nude-700">{longDate(date)}</p>
                  {!times ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <span key={i} className="h-12 animate-skeleton rounded-2xl bg-rose-50" />)}</div>
                    : times.length === 0 ? <p className="text-sm">Sem horários neste dia. <Link className="text-rose-600 underline" href={`/espera?servico=${serviceId}&data=${date}`}>Entrar na lista de espera</Link></p>
                    : <>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {times.map(({ t, free }, i) => (
                          <button key={t} type="button" disabled={!free} onClick={() => setTime(t)} aria-pressed={t === time} style={{ animationDelay: `${i * 28}ms` }}
                            title={free ? '' : 'Horário já reservado'}
                            className={`relative min-h-12 animate-fadeUp rounded-2xl border text-sm font-medium transition duration-300 ${!free ? 'cursor-not-allowed border-nude-200 bg-nude-100/80 text-nude-700/50' : t === time ? 'scale-105 border-transparent bg-gradient-to-br from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-600/30' : 'border-rose-200 bg-white text-rose-600 hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md'}`}>
                            <span className={free ? '' : 'line-through decoration-nude-700/40'}>{t}</span>
                            {!free && <span className="block text-[9px] font-semibold uppercase leading-none tracking-wider">Ocupado</span>}
                          </button>))}
                      </div>
                      <p className="mt-3 text-[11px] text-nude-700">Horários riscados já estão reservados por outra cliente.</p>
                    </>}
                </Card>
              </div>
            )}
            <Msg error={err} />
          </div>
        )}

        {step === 2 && svc && date && time && (
          <form onSubmit={submit} className="space-y-4">
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-rose-600 transition hover:gap-2"><IconBack />Trocar dia ou horário</button>
            <Card className="space-y-2 bg-gradient-to-br from-rose-600 to-rose-500 !text-white">
              <p className="text-[11px] uppercase tracking-[.25em] text-ouro-2">Seu horário</p>
              <p className="font-display text-3xl font-semibold leading-tight">{svc.name}</p>
              <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/90"><span className="inline-flex items-center gap-1.5 capitalize"><IconCalendar width={16} height={16} />{longDate(date)}</span><span className="inline-flex items-center gap-1.5"><IconClock width={16} height={16} />{time}</span></p>
              <p className="border-t border-white/20 pt-2 text-sm">Valor {brl(svc.price_cents)}{svc.deposit_required && svc.deposit_cents > 0 ? `  ·  sinal de ${brl(svc.deposit_cents)} para garantir` : ''}</p>
            </Card>
            <Card className="space-y-3">
              <h2 className="text-3xl font-semibold text-rose-600">Seus dados</h2>
              <Field label="Nome completo"><input required minLength={3} className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
              <Field label="WhatsApp (com DDD)"><input required inputMode="tel" placeholder="(11) 91234-5678" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></Field>
              <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-1 h-5 w-5 accent-rose-600" />Aceito receber confirmação e lembretes deste agendamento por WhatsApp.</label>
              <div className="rounded-2xl border border-ouro/40 bg-rose-50 p-3 text-sm"><p className="mb-1 font-display text-xl font-semibold text-rose-600">Política de cancelamento</p><p className="text-nude-700">{info?.policy}</p></div>
              <label className="flex gap-2 text-sm"><input required type="checkbox" checked={f.policy} onChange={(e) => setF({ ...f, policy: e.target.checked })} className="mt-1 h-5 w-5 accent-rose-600" />Li e aceito a política de cancelamento.</label>
              <Msg error={err} />
              <Btn type="submit" disabled={busy} className="w-full">{busy ? 'Reservando…' : svc.deposit_required && svc.deposit_cents > 0 ? 'Continuar para o pagamento' : 'Confirmar agendamento'}</Btn>
            </Card>
          </form>
        )}
      </div>

      {step === 1 && time && (
        <div className="fixed inset-x-0 bottom-0 z-20 animate-slideUp border-t border-white/60 bg-white/90 p-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <span className="text-sm"><b className="text-rose-600">{time}</b> · <span className="capitalize">{date && longDate(date)}</span></span>
            <Btn onClick={() => setStep(2)}>Continuar</Btn>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Page() { return <Suspense><Wizard /></Suspense>; }
