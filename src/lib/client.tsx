'use client';
import { useEffect, useState, type ReactNode } from 'react';

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'Erro inesperado');
  return j as T;
}

export function useApi<T = any>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let off = false;
    api<T>(url).then((d) => !off && (setData(d), setError(''))).catch((e) => !off && setError(e.message));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

export const STATUS_LABEL: Record<string, string> = {
  aguardando_pagamento: 'Aguardando pagamento', aguardando_confirmacao: 'Aguardando confirmação', confirmado: 'Confirmado',
  em_atendimento: 'Em atendimento', concluido: 'Concluído', cancelado: 'Cancelado', nao_compareceu: 'Cliente não compareceu',
};
export const METHOD_LABEL: Record<string, string> = { pix: 'PIX', credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', cash: 'Dinheiro', other: 'Outra' };

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/70 bg-white/85 p-4 shadow-glass backdrop-blur-sm ${className}`}>{children}</div>;
}
export function Btn({ children, variant = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'btn-shine bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-600/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-600/35',
    ghost: 'border border-rose-200 bg-white/60 text-rose-600 hover:border-rose-400 hover:bg-rose-50',
    danger: 'border border-red-300 bg-white/60 text-red-700 hover:bg-red-50',
  }[variant];
  return <button {...p} className={`min-h-11 rounded-full px-5 text-sm font-medium tracking-wide transition duration-300 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 ${v} ${className}`}>{children}</button>;
}
export const inputCls = 'min-h-11 w-full rounded-2xl border border-nude-200 bg-white/90 px-3 text-base text-nude-900 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100';
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm text-nude-700"><span className="mb-1 block font-medium">{label}</span>{children}</label>;
}
export function Msg({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return <p role="alert" className={`animate-fadeIn rounded-2xl px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || ok}</p>;
}
