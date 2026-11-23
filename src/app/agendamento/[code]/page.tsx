'use client';
import { use, useEffect, useState } from 'react';
import { api, Btn, Card, Field, inputCls, METHOD_LABEL, Msg, STATUS_LABEL, useApi } from '@/lib/client';
import { brl, fmtDateBR, fmtTimeBR } from '@/lib/time';

type Pay = { id: string; method: string; kind: string; status: string; amount_cents: number; pix_qr_code: string | null; pix_qr_base64: string | null; expires_at: string | null };
type B = { code: string; name: string; service_name: string; start_at: string; end_at: string; status: string; total_cents: number; deposit_cents: number; paid_cents: number; balance_cents: number; hold_expires_at: string | null; cancel_reason: string | null; policy: string; contact: string; payments: Pay[] };

export default function Booking({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [poll, setPoll] = useState(0);
  const { data: b, error } = useApi<B>(`/api/bookings/${code}`, [poll]);
  const [pix, setPix] = useState<{ qr: string; qrBase64: string; expires_at: string } | null>(null);
  const [payFull, setPayFull] = useState(false), [email, setEmail] = useState('');
  const [msg, setMsg] = useState(''), [ok, setOk] = useState(''), [busy, setBusy] = useState(false);
  const [cancel, setCancel] = useState(false), [c, setC] = useState({ last4: '', reason: '' });
  const [now, setNow] = useState(Date.now());
  const { data: pub } = useApi<{ payment_methods: { pix: boolean; card: boolean } }>('/api/services');

  // atualiza o status enquanto aguarda pagamento (confirmação automática vem do webhook/consulta ao provedor)
  useEffect(() => {
    if (b?.status !== 'aguardando_pagamento') return;
    const t = setInterval(() => { setPoll((x) => x + 1); setNow(Date.now()); }, 5000);
    return () => clearInterval(t);
  }, [b?.status]);

  const activePix = pix ?? (() => { const p = b?.payments.find((x) => x.method === 'pix' && x.status === 'pendente' && x.pix_qr_code); return p ? { qr: p.pix_qr_code!, qrBase64: p.pix_qr_base64!, expires_at: p.expires_at! } : null; })();

  async function run(fn: () => Promise<void>) { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg((e as Error).message); } setBusy(false); }
  const doPix = () => run(async () => { setPix(await api(`/api/bookings/${code}/pix`, { method: 'POST', json: { payFull, email: email || undefined } })); });
  const doCard = () => run(async () => { const r = await api<{ url: string }>(`/api/bookings/${code}/checkout`, { method: 'POST', json: { payFull } }); window.location.href = r.url; });
  const doCancel = () => run(async () => { await api(`/api/bookings/${code}/cancel`, { method: 'POST', json: { phoneLast4: c.last4, reason: c.reason } }); setCancel(false); setOk('Agendamento cancelado.'); setPoll((x) => x + 1); });

  if (error) return <main className="mx-auto max-w-xl p-6"><Msg error={error} /></main>;
  if (!b) return <main className="mx-auto max-w-xl p-6 text-nude-700">Carregando…</main>;
  const awaiting = b.status === 'aguardando_pagamento';
  const remaining = b.hold_expires_at ? Math.max(0, Math.floor((new Date(b.hold_expires_at).getTime() - now) / 1000)) : 0;
  const canCancel = ['aguardando_pagamento', 'aguardando_confirmacao', 'confirmado'].includes(b.status);

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 pb-16 pt-8">
      <div className="animate-fadeUp text-center">
        {b.status === 'confirmado' && (
          <span className="mx-auto mb-3 grid h-20 w-20 animate-pop place-items-center rounded-full bg-gradient-to-br from-rose-600 to-rose-500 text-white shadow-lift">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path className="draw-check animate-draw" d="M5 12.5l4.5 4.5L19 7.500" /></svg>
          </span>
        )}
        <h1 className="text-4xl font-semibold text-rose-600">{b.status === 'confirmado' ? 'Agendamento confirmado' : b.status === 'cancelado' ? 'Agendamento cancelado' : 'Seu agendamento'}</h1>
        <div className="gold-line mx-auto mt-3 w-24" />
      </div>
      <Card className="animate-fadeUp space-y-2 text-sm [animation-delay:120ms]">
        <p className="text-base">Olá, <b>{b.name}</b>.</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-nude-700">Procedimento</dt><dd className="font-medium">{b.service_name}</dd>
          <dt className="text-nude-700">Data</dt><dd className="font-medium">{fmtDateBR(b.start_at)}</dd>
          <dt className="text-nude-700">Horário</dt><dd className="font-medium">{fmtTimeBR(b.start_at)}</dd>
          <dt className="text-nude-700">Código</dt><dd className="font-semibold tracking-[.25em] text-rose-600">{b.code}</dd>
          <dt className="text-nude-700">Status</dt><dd className="font-medium">{STATUS_LABEL[b.status]}</dd>
        </dl>
        <div className="gold-line" />
        <p className="flex justify-between"><span>Total</span><b>{brl(b.total_cents)}</b></p>
        <p className="flex justify-between"><span>Pago</span><b>{brl(b.paid_cents)}</b></p>
        <p className="flex justify-between text-rose-600"><span>Saldo no atendimento</span><b>{brl(b.balance_cents)}</b></p>
        {b.status === 'cancelado' && b.cancel_reason === 'pagamento_expirado' && <p className="text-red-700">O prazo do pagamento expirou e o horário foi liberado. <a className="underline" href="/agendar">Agendar novamente</a>.</p>}
      </Card>

      {awaiting && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold">Pagamento para garantir o horário</h2>
          {remaining > 0 && <p className="text-sm text-nude-700">Horário reservado por mais {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}.</p>}
          {b.deposit_cents < b.total_cents && (
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={!payFull} onChange={() => setPayFull(false)} className="h-5 w-5" /> Pagar sinal: {brl(b.deposit_cents)}</label>
              <label className="flex items-center gap-2"><input type="radio" checked={payFull} onChange={() => setPayFull(true)} className="h-5 w-5" /> Pagar valor integral: {brl(b.total_cents)}</label>
            </div>
          )}
          <div className="rounded-xl bg-rose-50 p-3 text-xs">{b.policy}</div>
          {activePix ? (
            <div className="space-y-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="QR Code PIX" className="mx-auto h-52 w-52" src={`data:image/png;base64,${activePix.qrBase64}`} />
              <textarea readOnly className={`${inputCls} h-24 py-2 text-xs`} value={activePix.qr} onFocus={(e) => e.currentTarget.select()} />
              <Btn variant="ghost" onClick={() => navigator.clipboard.writeText(activePix.qr).then(() => setOk('Código copiado!'))}>Copiar código PIX</Btn>
              <p className="text-xs text-nude-700">Válido até {fmtTimeBR(activePix.expires_at)}. A confirmação é automática após o pagamento — não precisa enviar comprovante.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pub?.payment_methods.pix && (<>
                <Field label="E-mail (para o comprovante do PIX)"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="opcional" /></Field>
                <Btn onClick={doPix} disabled={busy} className="w-full">Pagar com PIX</Btn>
              </>)}
              {pub?.payment_methods.card && <Btn variant="ghost" onClick={doCard} disabled={busy} className="w-full">Pagar com cartão (crédito/débito)</Btn>}
            </div>
          )}
          <Msg error={msg} ok={ok} />
          {b.payments.some((p) => p.status === 'recusado') && <p className="text-sm text-red-700">Um pagamento foi recusado. Você pode tentar novamente acima.</p>}
        </Card>
      )}

      {b.payments.length > 0 && (
        <Card><h2 className="mb-2 text-base font-semibold">Pagamentos</h2>
          <ul className="space-y-1 text-sm">{b.payments.map((p) => <li key={p.id}>{METHOD_LABEL[p.method]} · {brl(p.amount_cents)} · {p.status}</li>)}</ul></Card>
      )}

      {b.status !== 'cancelado' && <p className="text-sm text-nude-700">{b.policy}</p>}
      {canCancel && !cancel && <Btn variant="danger" onClick={() => setCancel(true)}>Cancelar agendamento</Btn>}
      {cancel && (
        <Card className="space-y-3">
          <p className="text-sm">Atenção: conforme a política acima, o sinal já pago <b>não é devolvido</b>.</p>
          <Field label="Últimos 4 dígitos do seu WhatsApp"><input inputMode="numeric" maxLength={4} className={inputCls} value={c.last4} onChange={(e) => setC({ ...c, last4: e.target.value })} /></Field>
          <Field label="Motivo"><input className={inputCls} value={c.reason} onChange={(e) => setC({ ...c, reason: e.target.value })} /></Field>
          <Msg error={msg} ok={ok} />
          <div className="flex gap-2"><Btn variant="danger" disabled={busy || c.last4.length !== 4 || c.reason.length < 3} onClick={doCancel}>Confirmar cancelamento</Btn><Btn variant="ghost" onClick={() => setCancel(false)}>Voltar</Btn></div>
        </Card>
      )}
      {ok && !cancel && !awaiting && <Msg ok={ok} />}
    </main>
  );
}
