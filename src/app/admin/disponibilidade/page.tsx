'use client';
import { useEffect, useState } from 'react';
import { api, Btn, Card, Field, inputCls, Msg, useApi } from '@/lib/client';

type H = { weekday: number; active: boolean; open_time: string; close_time: string };
type Br = { id: string; weekday: number | null; start_time: string; end_time: string; label: string | null };
type Bl = { id: string; date_from: string; date_to: string; start_time: string | null; end_time: string | null; kind: string; reason: string | null };
const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const post = (json: object) => api('/api/admin/availability', { method: 'POST', json });

export default function Disponibilidade() {
  const { data, reload, error } = useApi<{ hours: H[]; breaks: Br[]; blocks: Bl[] }>('/api/admin/availability');
  const [hours, setHours] = useState<H[]>([]), [msg, setMsg] = useState(''), [ok, setOk] = useState('');
  const [br, setBr] = useState({ weekday: '', start_time: '12:00', end_time: '13:00', label: 'Almoço' });
  const [bl, setBl] = useState({ date_from: '', date_to: '', start_time: '', end_time: '', kind: 'folga', reason: '' });
  useEffect(() => { if (data) setHours(data.hours.map((h) => ({ ...h, open_time: h.open_time.slice(0, 5), close_time: h.close_time.slice(0, 5) }))); }, [data]);
  const run = async (fn: () => Promise<unknown>, done = '') => { setMsg(''); setOk(''); try { await fn(); setOk(done); reload(); } catch (e) { setMsg((e as Error).message); } };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold text-rose-600">Horários de funcionamento</h1>
      <Msg error={msg || error} ok={ok} />
      <Card className="space-y-2">
        {hours.map((h, i) => (
          <div key={h.weekday} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex w-28 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={h.active} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} />{WD[h.weekday]}</label>
            <input type="time" className={`${inputCls} !w-28`} value={h.open_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))} />
            <span>às</span>
            <input type="time" className={`${inputCls} !w-28`} value={h.close_time} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))} />
          </div>))}
        <Btn onClick={() => run(() => post({ action: 'hours', rows: hours }), 'Horários salvos.')}>Salvar horários</Btn>
      </Card>

      <Card className="space-y-2"><h2 className="font-semibold">Intervalos e pausas (almoço…)</h2>
        {data?.breaks.map((b) => <div key={b.id} className="flex items-center justify-between text-sm"><span>{b.label ?? 'Pausa'} · {b.weekday === null ? 'todos os dias' : WD[b.weekday]} · {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}</span><Btn variant="danger" onClick={() => run(() => post({ action: 'delBreak', id: b.id }))}>Remover</Btn></div>)}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Dia"><select className={`${inputCls} !w-auto`} value={br.weekday} onChange={(e) => setBr({ ...br, weekday: e.target.value })}><option value="">Todos</option>{WD.map((w, i) => <option key={i} value={i}>{w}</option>)}</select></Field>
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
