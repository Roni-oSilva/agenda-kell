-- =====================================================================
-- Agenda Nail Designer — schema Supabase (rode inteiro no SQL Editor)
-- Valores monetários em centavos (integer). Fuso: America/Sao_Paulo.
-- =====================================================================
create extension if not exists pgcrypto;

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid());
$$;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_e164 text not null unique,          -- identifica cliente recorrente
  whatsapp_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists customer_profiles (   -- ficha da cliente
  customer_id uuid primary key references customers(id) on delete cascade,
  nail_preferences text, shape text, length text, decoration text,
  allergies text,                                -- informado voluntariamente
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  price_cents integer not null check (price_cents >= 0),
  duration_min integer not null check (duration_min > 0),
  active boolean not null default true,
  category text not null default 'Outros',          -- agrupa no catálogo (Alongamentos, Manutenção, Extras…)
  deposit_mode text not null default 'none' check (deposit_mode in ('none','fixed','percent','full')),
  deposit_value integer not null default 0 check (deposit_value >= 0), -- centavos (fixed) ou % (percent)
  deposit_required boolean not null default false,  -- sinal obrigatório p/ garantir horário
  return_days integer,                              -- sugestão de manutenção (dias)
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  customer_id uuid not null references customers(id),
  service_id uuid references services(id) on delete set null,
  -- snapshot: alterar preço do serviço NÃO altera agendamentos antigos
  service_name text not null,
  duration_min integer not null,
  total_cents integer not null check (total_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  paid_cents integer not null default 0 check (paid_cents >= 0),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'aguardando_confirmacao' check (status in
    ('aguardando_pagamento','aguardando_confirmacao','confirmado','em_atendimento','concluido','cancelado','nao_compareceu')),
  hold_expires_at timestamptz,
  cancel_reason text,
  canceled_by text,
  policy_accepted_at timestamptz,
  whatsapp_consent boolean not null default false,
  notes text,
  created_by text not null default 'cliente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  -- PROTEÇÃO CONTRA RESERVA DUPLICADA (atômica, vale mesmo com requisições simultâneas)
  constraint no_overlap exclude using gist (tstzrange(start_at, end_at, '[)') with &&)
    where (status in ('aguardando_pagamento','aguardando_confirmacao','confirmado','em_atendimento','concluido'))
);
create index if not exists bookings_start_idx on bookings(start_at);
create index if not exists bookings_customer_idx on bookings(customer_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider text not null check (provider in ('mercadopago','manual')),
  provider_payment_id text unique,
  method text not null check (method in ('pix','credit_card','debit_card','cash','other')),
  kind text not null check (kind in ('sinal','integral','saldo')),
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado','expirado','cancelado')),
  pix_qr_code text, pix_qr_base64 text, expires_at timestamptz,
  paid_at timestamptz, installments integer,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_booking_idx on payments(booking_id);

create table if not exists payment_events (       -- idempotência de webhooks
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists weekly_hours (
  weekday integer primary key check (weekday between 0 and 6), -- 0 = domingo
  active boolean not null default false,
  open_time time not null default '09:00',
  close_time time not null default '18:00'
);
insert into weekly_hours(weekday, active, open_time, close_time) values
  (0,false,'09:00','18:00'),(1,true,'09:00','18:00'),(2,true,'09:00','18:00'),(3,true,'09:00','18:00'),
  (4,true,'09:00','18:00'),(5,true,'09:00','18:00'),(6,false,'09:00','14:00')
on conflict do nothing;

create table if not exists breaks (               -- almoço / pausas (weekday null = todos os dias)
  id uuid primary key default gen_random_uuid(),
  weekday integer check (weekday between 0 and 6),
  start_time time not null, end_time time not null,
  label text,
  check (end_time > start_time)
);

create table if not exists blocks (               -- folgas, feriados, bloqueios (dia inteiro ou faixa de horas)
  id uuid primary key default gen_random_uuid(),
  date_from date not null, date_to date not null,
  start_time time, end_time time,                 -- null = dia inteiro
  kind text not null default 'bloqueio' check (kind in ('folga','feriado','bloqueio')),
  reason text,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists settings (
  key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
insert into settings(key, value) values
  ('studio',   '{"name":"Nail Designer","whatsapp_contact":""}'),
  ('booking',  '{"slot_step_min":30,"min_notice_hours":2,"max_days_ahead":60,"hold_minutes":15,"pix_expiration_minutes":30,"max_installments":3}'),
  ('payment_methods', '{"pix":true,"card":true,"cash":true}'),
  ('policy',   '{"text":"O sinal garante a reserva do horário. Em caso de cancelamento pela cliente, o sinal não é devolvido. Se o cancelamento for feito pela profissional, entraremos em contato para resolver a situação."}'),
  ('whatsapp', '{"enabled":true,"confirmation":true,"reminder_24h":true,"reminder_2h":false,"waitlist":true,"followup":true,"language":"pt_BR","templates":{"confirmation":"confirmacao_agendamento","reminder_24h":"lembrete_24h","reminder_2h":"lembrete_2h","waitlist":"vaga_disponivel","followup":"retorno_manutencao"}}')
on conflict do nothing;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  kind text not null,                              -- confirmation | reminder_24h | reminder_2h | waitlist | followup | manual
  dedupe_key text not null unique,                 -- evita mensagens duplicadas
  to_phone text not null,
  template text, params jsonb, body text,
  status text not null default 'pendente' check (status in ('pendente','enviado','falhou','cancelado')),
  attempts integer not null default 0,
  error text, provider_message_id text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_pending_idx on notifications(status, scheduled_for);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone_e164 text not null,
  service_id uuid not null references services(id) on delete cascade,
  preferred_dates date[] not null default '{}',
  periods text[] not null default '{}',            -- manha | tarde | noite
  whatsapp_consent boolean not null default false,
  status text not null default 'aguardando' check (status in ('aguardando','notificada','atendida','cancelada')),
  notified_for timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists followups (             -- retorno / manutenção programada
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  due_date date not null,
  status text not null default 'pendente' check (status in ('pendente','enviado','cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  actor text, action text not null, entity text, entity_id text, data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists automation_runs (
  id bigserial primary key,
  job text not null, started_at timestamptz not null default now(), finished_at timestamptz,
  ok boolean, detail jsonb, error text
);

-- Libera horários de reservas temporárias vencidas (chamada antes de cada reserva e pelo cron)
create or replace function expire_holds() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update bookings set status = 'cancelado', cancel_reason = 'pagamento_expirado', canceled_by = 'sistema',
         updated_at = now(), hold_expires_at = null
   where status = 'aguardando_pagamento' and hold_expires_at is not null and hold_expires_at < now();
  get diagnostics n = row_count;
  update payments set status = 'expirado'
   where status = 'pendente' and booking_id in (select id from bookings where status = 'cancelado' and cancel_reason = 'pagamento_expirado');
  return n;
end $$;

-- Aprovação idempotente de pagamento (usada pelo webhook)
create or replace function apply_approved_payment(p_payment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b bookings; p payments;
begin
  select * into p from payments where id = p_payment_id for update;
  select * into b from bookings where id = p.booking_id for update;
  update bookings set paid_cents = coalesce((select sum(amount_cents) from payments where booking_id = b.id and status = 'aprovado'),0),
         updated_at = now() where id = b.id;
  if b.status in ('aguardando_pagamento','aguardando_confirmacao') then
    update bookings set status = 'confirmado', hold_expires_at = null where id = b.id;
  end if;
end $$;

-- RLS: tudo fechado ao público; o servidor usa service_role; admins autenticados têm acesso total
do $$
declare t text;
begin
  for t in select unnest(array['admin_users','customers','customer_profiles','services','bookings','payments','payment_events',
    'weekly_hours','breaks','blocks','settings','notifications','waitlist','followups','audit_log','automation_runs']) loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists admin_all on %I', t);
    execute format('create policy admin_all on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Foto dos procedimentos: crie manualmente o bucket público "services" em Storage.
-- Depois de criar seu usuário em Authentication, torne-o admin:
--   insert into admin_users(user_id) select id from auth.users where email = 'SEU_EMAIL';

-- Atualização (categorias): bancos criados antes desta versão rodam também este trecho
alter table services add column if not exists category text not null default 'Outros';
