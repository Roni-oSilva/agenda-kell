# Agenda Nail Designer

Next.js 15 + Tailwind + Supabase (Postgres/Auth/Storage) + Mercado Pago + WhatsApp Cloud API. Deploy na Vercel.

## Colocar no ar
1. Crie um projeto no Supabase e rode `supabase/schema.sql` no SQL Editor.
2. Em Storage, crie o bucket **público** `services` (fotos dos procedimentos).
3. Em Authentication, crie o usuário da profissional e rode: `insert into admin_users(user_id) select id from auth.users where email = 'EMAIL';`
4. Copie `.env.example` para `.env.local` (e configure as mesmas variáveis na Vercel).
5. `npm install && npm run dev` — painel em `/admin`. Cadastre procedimentos, horários e configurações antes de divulgar.
6. Ative os backups automáticos/PITR do Supabase (o painel também exporta JSON manual).

## Mercado Pago
- `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` (painel de desenvolvedor → Webhooks, evento **Pagamentos**, URL `https://SEU-SITE/api/webhooks/mercadopago`).
- PIX: cobrança individual com QR dinâmico e copia-e-cola. O MP exige e-mail do pagador: a cliente pode informá-lo (opcional) ou defina `MP_FALLBACK_PAYER_EMAIL`.
- Cartão: Checkout Pro (página do Mercado Pago) — nenhum dado de cartão toca o servidor.
- A confirmação só ocorre após consultar o pagamento no Mercado Pago (webhook assinado + conferência periódica). Comprovantes enviados pela cliente nunca confirmam nada.
- Sem módulo de reembolso/estorno, por decisão de projeto.

## WhatsApp (Cloud API)
Configure `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` e cadastre na Meta os templates (categoria utilidade, pt_BR), com os nomes em Configurações → WhatsApp. Parâmetros, em ordem:
- `confirmacao_agendamento`, `lembrete_24h`, `lembrete_2h`: {{1}} nome, {{2}} data, {{3}} hora, {{4}} procedimento
- `vaga_disponivel`: {{1}} nome, {{2}} procedimento, {{3}} data, {{4}} hora, {{5}} link
- `retorno_manutencao`: {{1}} nome, {{2}} procedimento, {{3}} link

Só envia a quem marcou o consentimento. Sem credenciais, a mensagem fica como **falhou** com o motivo — nunca é marcada como enviada.

## Tarefas agendadas
`vercel.json` chama `/api/cron/run` a cada 5 min com `Authorization: Bearer $CRON_SECRET` (defina `CRON_SECRET` na Vercel). Cron a cada 5 min exige plano Pro; no Hobby só é permitido 1x/dia — use um agendador externo (ex.: cron-job.org) chamando a mesma URL com o header. Jobs: expirar reservas, conferir pagamentos pendentes, lembretes, lista de espera, retornos, envio. Cada execução fica em `automation_runs`; duplicidade é impedida por `notifications.dedupe_key` único.

## Anti-conflito de horários
Constraint `EXCLUDE USING gist` em `bookings` (schema.sql): o próprio Postgres recusa sobreposição, mesmo com duas clientes reservando no mesmo instante.

## Testes
`npm test` (disponibilidade, financeiro, telefone/fuso). `npm run typecheck`.
