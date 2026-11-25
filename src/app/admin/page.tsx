'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarCheck2, Check, CircleDollarSign, Clock3, Hourglass, MessageCircle, RotateCcw, Trash2, UserX, X } from 'lucide-react';
import Counter from '@/components/ui/counter';
import { api, Msg, useApi } from '@/lib/client';
import { brl, dateOfInstant, fmtDateBR, fmtTimeBR } from '@/lib/time';

type Cust = { id: string; name: string; phone_e164: string };
type B = { id: string; public_code: string; service_name: string; start_at: string; status: string; total_cents: number; deposit_cents: number; paid_cents: number; created_at: string; customers: Cust; pix_amount_cents?: number; cancel_reason?: string | null };
type Note = { e?: string; o?: string; href?: string; label?: string };
const agendaLink = (b: { start_at: string }) => `/admin/agenda?dia=${dateOfInstant(b.start_at)}`;
const when = (b: { start_at: string }) => `${fmtDateBR(b.start_at)} às ${fmtTimeBR(b.start_at)}`;
type Summary = { toConfirm: B[]; waitingPix: B[]; toAccept: B[]; today: B[]; upcoming: B[]; history: B[]; weekCount: number; monthReceivedCents: number; receivableCents: number };

const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };
const STATUS: Record<string, string> = { confirmado: 'Confirmado', em_atendimento: 'Em atendimento', concluido: 'Concluído', aguardando_pagamento: 'Aguardando PIX', aguardando_confirmacao: 'A confirmar' };

function Item({ b, kind, onDone, setMsg }: { b: B; kind: 'confirm' | 'wait' | 'accept'; onDone: () => void; setMsg: (m: Note) => void }) {
  const [busy, setBusy] = useState(false);
  const value = brl(b.pix_amount_cents ?? b.deposit_cents);
  async function run(fn: () => Promise<unknown>, note: Note) { setBusy(true); setMsg({}); try { await fn(); setMsg(note); onDone(); } catch (e) { setMsg({ e: (e as Error).message }); } setBusy(false); }
  const confirmPay = () => confirm(`Confirmar que ${value} caiu na sua conta (código ${b.public_code})?`) && run(() => api(`/api/admin/bookings/${b.id}/confirm-payment`, { method: 'POST', json: {} }), { o: `Pagamento confirmado. ${b.customers.name} foi para a Agenda em ${when(b)} e para Próximos confirmados.`, href: agendaLink(b), label: 'Ver na agenda' });
  const accept = () => run(() => api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', json: { status: 'confirmado' } }), { o: `Aceito. ${b.customers.name} foi para a Agenda em ${when(b)} e para Próximos confirmados.`, href: agendaLink(b), label: 'Ver na agenda' });
  const refuse = () => { const reason = prompt('Por que está removendo? (fica registrado no histórico)'); if (reason && reason.trim().length >= 3) run(() => api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', json: { status: 'cancelado', reason: reason.trim() } }), { o: `Removido. O horário foi liberado e ${b.customers.name} está no Histórico, aba Removidos.`, href: '#historico', label: 'Ver no histórico' }); };
  return (
    <article className="gd-item" data-gd-item data-urgent={kind === 'confirm'}>
      <div className="gd-item-top">
        <div><strong>{b.customers.name}</strong><p>{b.service_name}</p></div>
        <span className="gd-chip" data-tone={kind === 'confirm' ? 'warn' : kind === 'wait' ? undefined : 'good'}>
          {kind === 'confirm' ? <>PIX informado {ago(b.created_at)}</> : kind === 'wait' ? <>Aguardando PIX</> : <>Pedido {ago(b.created_at)}</>}
        </span>
      </div>
      <p><b>{fmtDateBR(b.start_at)}</b> às <b>{fmtTimeBR(b.start_at)}</b>{kind !== 'accept' && <> · sinal <span className="gd-money">{value}</span> · código <b>{b.public_code}</b></>}</p>
      <div className="gd-item-actions">
        {kind !== 'accept' && <button type="button" className="gd-primary" disabled={busy} onClick={confirmPay}><BadgeCheck aria-hidden />Confirmar recebimento</button>}
        {kind === 'accept' && <button type="button" className="gd-primary" disabled={busy} onClick={accept}><Check aria-hidden />Aceitar</button>}
        <button type="button" className="gd-danger" disabled={busy} onClick={refuse}><X aria-hidden />{kind === 'wait' ? 'Remover (libera o horário)' : 'Remover'}</button>
        <a className="gd-secondary" href={`https://wa.me/${b.customers.phone_e164}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden />WhatsApp</a>
      </div>
    </article>
  );
}

function Confirmed({ b, onDone, setMsg }: { b: B; onDone: () => void; setMsg: (m: Note) => void }) {
  const [busy, setBusy] = useState(false);
  async function change(status: string, note: Note, reason?: string) { setBusy(true); setMsg({}); try { await api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', json: { status, reason } }); setMsg(note); onDone(); } catch (e) { setMsg({ e: (e as Error).message }); } setBusy(false); }
  const toHistory = { href: '#historico', label: 'Ver no histórico' };
  const done = () => change('concluido', { o: `Concluído. ${b.customers.name} foi para o Histórico, aba Concluídos.`, ...toHistory });
  const missed = () => confirm('Marcar que a cliente não compareceu?') && change('nao_compareceu', { o: 'Marcado como falta. Está no Histórico.', ...toHistory });
  const remove = () => { const reason = prompt('Por que está removendo? (o horário é liberado; o valor pago permanece no financeiro)'); if (reason && reason.trim().length >= 3) change('cancelado', { o: `Removido. O horário de ${when(b)} ficou livre e ${b.customers.name} está no Histórico, aba Removidos.`, ...toHistory }, reason.trim()); };
  const balance = b.total_cents - b.paid_cents;
  return (
    <article className="gd-item">
      <div className="gd-item-top"><div><strong>{b.customers.name}</strong><p>{b.service_name}</p></div><span className="gd-chip" data-tone="good">{b.status === 'em_atendimento' ? 'Em atendimento' : 'Confirmado'}</span></div>
      <p><b>{when(b)}</b> · pago <span className="gd-money">{brl(b.paid_cents)}</span>{balance > 0 && <> · falta <span className="gd-money">{brl(balance)}</span></>}</p>
      <div className="gd-item-actions">
        <button type="button" className="gd-primary" disabled={busy} onClick={done}><Check aria-hidden />Concluir</button>
        <Link className="gd-secondary" href={agendaLink(b)}><CalendarCheck2 aria-hidden />Ver na agenda</Link>
        <a className="gd-secondary" href={`https://wa.me/${b.customers.phone_e164}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden />WhatsApp</a>
        <button type="button" className="gd-secondary" disabled={busy} onClick={missed}><UserX aria-hidden />Não veio</button>
        <button type="button" className="gd-danger" disabled={busy} onClick={remove}><X aria-hidden />Remover</button>
      </div>
    </article>
  );
}

function History({ items, onDone, setMsg }: { items: B[]; onDone: () => void; setMsg: (m: Note) => void }) {
  const [tab, setTab] = useState<'removed' | 'done'>('removed');
  const [busy, setBusy] = useState('');
  const list = items.filter((b) => (tab === 'removed' ? b.status === 'cancelado' : b.status !== 'cancelado'));
  async function run(id: string, fn: () => Promise<unknown>, note: Note) { setBusy(id); setMsg({}); try { await fn(); setMsg(note); onDone(); } catch (e) { setMsg({ e: (e as Error).message }); } setBusy(''); }
  return (
    <section className="gd-panel" id="historico" data-gd-enter>
      <header className="gd-panel-head">
        <div><h2>Histórico</h2><p>Para onde vai tudo o que sai da agenda.</p></div>
        <div className="gd-item-actions">
          <button type="button" className={tab === 'removed' ? 'gd-primary' : 'gd-secondary'} onClick={() => setTab('removed')}>Removidos</button>
          <button type="button" className={tab === 'done' ? 'gd-primary' : 'gd-secondary'} onClick={() => setTab('done')}>Concluídos e faltas</button>
        </div>
      </header>
      <div className="gd-queue">
        {list.map((b) => (
          <article className="gd-item" key={b.id}>
            <div className="gd-item-top"><div><strong>{b.customers.name}</strong><p>{b.service_name} · {when(b)}</p></div>
              <span className="gd-chip" data-tone={b.status === 'concluido' ? 'good' : 'bad'}>{b.status === 'concluido' ? 'Concluído' : b.status === 'nao_compareceu' ? 'Não veio' : b.cancel_reason === 'pagamento_expirado' ? 'PIX expirou' : 'Removido'}</span></div>
            {b.status === 'cancelado' && <>
              <p>Motivo: {b.cancel_reason === 'pagamento_expirado' ? 'prazo do pagamento venceu' : b.cancel_reason ?? 'não informado'}{b.paid_cents > 0 && <> · pago <span className="gd-money">{brl(b.paid_cents)}</span> (fica no financeiro)</>}</p>
              <div className="gd-item-actions">
                <button type="button" className="gd-secondary" disabled={busy === b.id} onClick={() => run(b.id, () => api(`/api/admin/bookings/${b.id}`, { method: 'PATCH', json: { status: 'confirmado' } }), { o: `Restaurado. ${b.customers.name} voltou para a Agenda em ${when(b)}.`, href: agendaLink(b), label: 'Ver na agenda' })}><RotateCcw aria-hidden />Restaurar</button>
                {b.paid_cents === 0 && <button type="button" className="gd-danger" disabled={busy === b.id} onClick={() => confirm('Excluir de vez? Não dá para desfazer.') && run(b.id, () => api(`/api/admin/bookings/${b.id}`, { method: 'DELETE' }), { o: 'Excluído de vez.' })}><Trash2 aria-hidden />Excluir de vez</button>}
              </div>
            </>}
          </article>
        ))}
        {list.length === 0 && <p className="gd-empty">{tab === 'removed' ? 'Nenhum agendamento removido.' : 'Nada concluído ainda.'}</p>}
      </div>
    </section>
  );
}

export default function Inicio() {
  const { data, error, reload } = useApi<Summary>('/api/admin/summary');
  const [msg, setMsg] = useState<Note>({});
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setInterval(reload, 20_000); return () => clearInterval(t); }, [reload]);
  // entrada animada dos cartões (GSAP); respeita "reduzir movimento"
  useEffect(() => {
    if (!data || !root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => { gsap.from('[data-gd-enter]', { y: 18, opacity: 0, stagger: 0.06, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity' }); }, root);
    return () => ctx.revert();
    // anima só na primeira carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  const toConfirmValue = (data?.toConfirm ?? []).reduce((a, b) => a + (b.pix_amount_cents ?? b.deposit_cents), 0);
  const attention = (data?.toConfirm.length ?? 0) + (data?.toAccept.length ?? 0);

  return (
    <div ref={root}>
      <header className="gd-view-head">
        <div><h1>Início</h1><p>{data ? (attention > 0 ? `${attention} ${attention === 1 ? 'item precisa' : 'itens precisam'} da sua atenção agora.` : 'Tudo em dia. Nada esperando por você.') : 'Carregando…'}</p></div>
        <Link href="/admin/agenda" className="gd-secondary"><CalendarCheck2 aria-hidden />Abrir agenda <ArrowUpRight aria-hidden /></Link>
      </header>
      <Msg error={error || msg.e} />
      {msg.o && (
        <div role="status" className="gd-item animate-fadeUp" style={{ borderColor: 'var(--gd-teal)' }}>
          <div className="gd-item-top"><strong>{msg.o}</strong>{msg.href && <Link className="gd-primary" href={msg.href}>{msg.label}<ArrowRight aria-hidden /></Link>}</div>
        </div>
      )}
      <p className="gd-empty" style={{ padding: '8px 2px 0' }}><b>Caminho de cada pedido:</b> PIX para conferir ou Pedido, depois <b>Confirmar/Aceitar</b>, vai para <b>Próximos confirmados</b> e para a Agenda; ao <b>Concluir</b> vai para o Histórico. <b>Remover</b> libera o horário e manda para Histórico, aba Removidos (dá para restaurar).</p>

      <div className="gd-grid gd-kpis" style={{ marginBlock: 12 }}>
        <article className="gd-metric" data-gd-enter data-tone={(data?.toConfirm.length ?? 0) > 0 ? 'alert' : undefined}>
          <div className="gd-metric-head"><span>PIX para conferir</span><span className="gd-metric-icon"><BadgeCheck aria-hidden /></span></div>
          <strong className="gd-metric-value"><Counter value={data?.toConfirm.length ?? 0} /></strong>
          <div className="gd-metric-caption">{brl(toConfirmValue)} a conferir na conta</div>
        </article>
        <article className="gd-metric" data-gd-enter data-tone={(data?.toAccept.length ?? 0) > 0 ? 'alert' : undefined}>
          <div className="gd-metric-head"><span>Pedidos para aceitar</span><span className="gd-metric-icon"><Hourglass aria-hidden /></span></div>
          <strong className="gd-metric-value"><Counter value={data?.toAccept.length ?? 0} /></strong>
          <div className="gd-metric-caption">sem sinal, esperando seu OK</div>
        </article>
        <article className="gd-metric" data-gd-enter>
          <div className="gd-metric-head"><span>Atendimentos hoje</span><span className="gd-metric-icon"><Clock3 aria-hidden /></span></div>
          <strong className="gd-metric-value"><Counter value={data?.today.length ?? 0} /></strong>
          <div className="gd-metric-caption">{data?.weekCount ?? 0} confirmados nos próximos 7 dias</div>
        </article>
        <article className="gd-metric" data-gd-enter data-tone="good">
          <div className="gd-metric-head"><span>Recebido no mês</span><span className="gd-metric-icon"><CircleDollarSign aria-hidden /></span></div>
          <strong className="gd-metric-value"><Counter value={(data?.monthReceivedCents ?? 0) / 100} format={(n) => brl(n * 100)} /></strong>
          <div className="gd-metric-caption">{brl(data?.receivableCents ?? 0)} ainda a receber</div>
        </article>
      </div>

      <div className="gd-grid gd-two">
        <div className="gd-grid">
          <section className="gd-panel" data-gd-enter>
            <header className="gd-panel-head"><div><h2>PIX para conferir</h2><p>A cliente avisou que pagou. Veja o valor na sua conta e confirme.</p></div></header>
            <div className="gd-queue">
              {data?.toConfirm.map((b) => <Item key={b.id} b={b} kind="confirm" onDone={reload} setMsg={setMsg} />)}
              {data && data.toConfirm.length === 0 && <p className="gd-empty">Nenhum PIX esperando conferência.</p>}
            </div>
          </section>
          <section className="gd-panel" data-gd-enter>
            <header className="gd-panel-head"><div><h2>Pedidos para aceitar</h2><p>Agendamentos sem sinal. Aceite ou recuse para a cliente saber.</p></div></header>
            <div className="gd-queue">
              {data?.toAccept.map((b) => <Item key={b.id} b={b} kind="accept" onDone={reload} setMsg={setMsg} />)}
              {data && data.toAccept.length === 0 && <p className="gd-empty">Nenhum pedido esperando.</p>}
            </div>
          </section>
          {!!data?.waitingPix.length && (
            <section className="gd-panel" data-gd-enter>
              <header className="gd-panel-head"><div><h2>Aguardando o PIX</h2><p>A cliente escolheu o horário e ainda não avisou o pagamento. O horário fica segurado por pouco tempo.</p></div></header>
              <div className="gd-queue">{data.waitingPix.map((b) => <Item key={b.id} b={b} kind="wait" onDone={reload} setMsg={setMsg} />)}</div>
            </section>
          )}
        </div>
        <div className="gd-grid">
        <section className="gd-panel" data-gd-enter>
          <header className="gd-panel-head"><div><h2>Hoje</h2><p>Seus atendimentos do dia.</p></div></header>
          <div className="gd-queue">
            {data?.today.map((b) => (
              <article className="gd-item" key={b.id}>
                <div className="gd-item-top"><div><strong>{fmtTimeBR(b.start_at)} · {b.customers.name}</strong><p>{b.service_name}</p></div><span className="gd-chip" data-tone={b.status === 'confirmado' || b.status === 'concluido' ? 'good' : 'warn'}>{STATUS[b.status] ?? b.status}</span></div>
                {b.total_cents - b.paid_cents > 0 && <p>Saldo a receber no atendimento: <span className="gd-money">{brl(b.total_cents - b.paid_cents)}</span></p>}
              </article>
            ))}
            {data && data.today.length === 0 && <p className="gd-empty">Nenhum atendimento hoje.</p>}
          </div>
        </section>
        </div>
      </div>

      <div className="gd-grid" style={{ marginTop: 12 }}>
        <section className="gd-panel" data-gd-enter>
          <header className="gd-panel-head"><div><h2>Próximos confirmados</h2><p>Aceitos ou pagos. Também aparecem na Agenda, no dia marcado.</p></div></header>
          <div className="gd-queue">
            {data?.upcoming.map((b) => <Confirmed key={b.id} b={b} onDone={reload} setMsg={setMsg} />)}
            {data && data.upcoming.length === 0 && <p className="gd-empty">Nenhum atendimento confirmado por vir.</p>}
          </div>
        </section>
        {data && <History items={data.history} onDone={reload} setMsg={setMsg} />}
      </div>
    </div>
  );
}
