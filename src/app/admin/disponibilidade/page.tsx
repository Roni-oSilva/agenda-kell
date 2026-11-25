'use client';
import { useEffect, useState } from 'react';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';

type H = { weekday: number; active: boolean; open_time: string; close_time: string };
type Br = { id: string; weekday: number | null; start_time: string; end_time: string; label: string | null };
type Bl = { id: string; date_from: string; date_to: string; start_time: string | null; end_time: string | null; kind: string; reason: string | null };
const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const post = (json: object) => api('/api/admin/availability', { method: 'POST', json });

export default function Disponibilidade() {
  const { data, reload, error } = useApi<{ hours: H[]; breaks: Br[]; blocks: Bl[]; slots: { weekday: number; slot_time: string }[] }>('/api/admin/availability');
  const [hours, setHours] = useState<H[]>([]), [msg, setMsg] = useState(''), [ok, setOk] = useState('');
  const [newTime, setNewTime] = useState<Record<number, string>>({});
  const slotsOf = (wd: number) => (data?.slots ?? []).filter((x) => x.weekday === wd).map((x) => x.slot_time.slice(0, 5)).sort();
  const saveSlots = (wd: number, times: string[]) => run(() => post({ action: 'slots', weekday: wd, times }), 'Horários do dia salvos.');
  const [br, setBr] = useState({ weekday: '', start_time: '12:00', end_time: '13:00', label: 'Almoço' });
  const [bl, setBl] = useState({ date_from: '', date_to: '', start_time: '', end_time: '', kind: 'folga', reason: '' });
  useEffect(() => { if (data) setHours(data.hours.map((h) => ({ ...h, open_time: h.open_time.slice(0, 5), close_time: h.close_time.slice(0, 5) }))); }, [data]);
  const run = async (fn: () => Promise<unknown>, done = '') => { setMsg(''); setOk(''); try { await fn(); setOk(done); reload(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl font-semibold text-rose-600">Horários de funcionamento</h1>
      <p className="text-sm text-nude-700">Domingo é sempre fechado.</p>
      <Msg error={msg || error} ok={ok} />
      <Card className="space-y-2">
        {hours.map((h, i) => h.weekday !== 0 && (
          <div key={h.weekday} className="space-y-2 border-b border-rose-50 pb-3 text-sm last:border-0">
            <label className="flex w-40 items-center gap-2 font-medium"><input type="checkbox" className="h-5 w-5 accent-rose-600" checked={h.active} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} />{WD[h.weekday]}{!h.active && <span className="text-xs font-normal text-nude-700">(fechado)</span>}</label>
            {h.active && (
              <div className="flex flex-wrap items-center gap-2 pl-7">
                {slotsOf(h.weekday).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1.5 font-medium text-rose-600">{t}<button type="button" aria-label={`Remover ${t}`} className="text-rose-400 transition hover:text-red-600" onClick={() => saveSlots(h.weekday, slotsOf(h.weekday).filter((x) => x !== t))}>×</button></span>
                ))}
                {slotsOf(h.weekday).length === 0 && <span className="text-xs text-nude-700">Sem horários fixos: usa abertura {h.open_time} e fechamento {h.close_time}.</span>}
                <input type="time" className={`${inputCls} !w-28`} value={newTime[h.weekday] ?? ''} onChange={(e) => setNewTime({ ...newTime, [h.weekday]: e.target.value })} />
                <Btn variant="ghost" disabled={!newTime[h.weekday]} onClick={() => { saveSlots(h.weekday, [...slotsOf(h.weekday), newTime[h.weekday]]); setNewTime({ ...newTime, [h.weekday]: '' }); }}>Adicionar horário</Btn>
              </div>
            )}
          </div>))}
        <Btn onClick={() => run(() => post({ action: 'hours', rows: hours }), 'Dias de funcionamento salvos.')}>Salvar dias de funcionamento</Btn>
      </Card>

      <Card className="space-y-2"><h2 className="font-semibold">Intervalos e pausas (almoço…)</h2>
        {data?.breaks.map((b) => <div key={b.id} className="flex items-center justify-between text-sm"><span>{b.label ?? 'Pausa'} · {b.weekday === null ? 'todos os dias' : WD[b.weekday]} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}</span><Btn variant="danger" onClick={() => run(() => post({ action: 'delBreak', id: b.id }))}>Remover</Btn></div>)}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Dia"><select className={`${inputCls} !w-auto`} value={br.weekday} onChange={(e) => setBr({ ...br, weekday: e.target.value })}><option value="">Todos</option>{WD.map((w, i) => i > 0 && <option key={i} value={i}>{w}</option>)}</select></Field>
          <Field label="Início"><input type="time" className={`${inputCls} !w-28`} value={br.start_time} onChange={(e) => setBr({ ...br, start_time: e.target.value })} /></Field>
          <Field label="Fim"><input type="time" className={`${inputCls} !w-28`} value={br.end_time} onChange={(e) => setBr({ ...br, end_time: e.target.value })} /></Field>
          <Field label="Nome"><input className={`${inputCls} !w-32`} value={br.label} onChange={(e) => setBr({ ...br, label: e.target.value })} /></Field>
          <Btn onClick={() => run(() => post({ action: 'addBreak', weekday: br.weekday === '' ? null : +br.weekday, start_time: br.start_time, end_time: br.end_time, label: br.label }), 'Intervalo adicionado.')}>Adicionar</Btn>
        </div>
      </Card>

      <Card className="space-y-2"><h2 className="font-semibold">Folgas, feriados e bloqueios</h2>
        <p className="text-xs text-nude-700">Deixe os horários em branco para bloquear o dia inteiro.</p>
        {data?.blocks.map((b) => <div key={b.id} className="flex items-center justify-between text-sm"><span>{b.kind} · {b.date_from.split('-').reverse().join('/')}{b.date_to !== b.date_from ? ` a ${b.date_to.split('-').reverse().join('/')}` : ''} · {b.start_time ? `${b.start_time.slice(0, 5)}–${b.end_time?.slice(0, 5)}` : 'dia inteiro'}{b.reason ? ` · ${b.reason}` : ''}</span><Btn variant="danger" onClick={() => run(() => post({ action: 'delBlock', id: b.id }))}>Remover</Btn></div>)}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="De"><input type="date" className={inputCls} value={bl.date_from} onChange={(e) => setBl({ ...bl, date_from: e.target.value, date_to: bl.date_to || e.target.value })} /></Field>
          <Field label="Até"><input type="date" className={inputCls} value={bl.date_to} onChange={(e) => setBl({ ...bl, date_to: e.target.value })} /></Field>
          <Field label="Hora início"><input type="time" className={`${inputCls} !w-28`} value={bl.start_time} onChange={(e) => setBl({ ...bl, start_time: e.target.value })} /></Field>
          <Field label="Hora fim"><input type="time" className={`${inputCls} !w-28`} value={bl.end_time} onChange={(e) => setBl({ ...bl, end_time: e.target.value })} /></Field>
          <Field label="Tipo"><select className={`${inputCls} !w-auto`} value={bl.kind} onChange={(e) => setBl({ ...bl, kind: e.target.value })}><option value="folga">Folga</option><option value="feriado">Feriado</option><option value="bloqueio">Bloqueio</option></select></Field>
          <Field label="Motivo"><input className={`${inputCls} !w-36`} value={bl.reason} onChange={(e) => setBl({ ...bl, reason: e.target.value })} /></Field>
          <Btn disabled={!bl.date_from} onClick={() => run(() => post({ action: 'addBlock', date_from: bl.date_from, date_to: bl.date_to || bl.date_from, start_time: bl.start_time || null, end_time: bl.end_time || null, kind: bl.kind, reason: bl.reason }), 'Bloqueio adicionado.')}>Bloquear</Btn>
        </div>
      </Card>
    </div>
  );
}
