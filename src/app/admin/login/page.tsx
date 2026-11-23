'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Brand from '@/components/Brand';
import { Btn, Card, Field, inputCls, Msg } from '@/lib/client';

export default function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    const supa = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) { setErr('E-mail ou senha incorretos.'); setBusy(false); return; }
    window.location.href = '/admin';
  }
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <div className="mb-6 animate-fadeUp"><Brand name="Painel" small /></div>
      <form onSubmit={submit} className="animate-slideUp"><Card className="space-y-3">
        <h1 className="text-3xl font-semibold text-rose-600">Entrar</h1>
        <Field label="E-mail"><input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Field label="Senha"><input type="password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <Msg error={err} /><Btn type="submit" disabled={busy} className="w-full">Entrar</Btn>
      </Card></form>
    </main>
  );
}
