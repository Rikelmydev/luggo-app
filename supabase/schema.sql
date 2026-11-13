-- Banco de dados da Luggo no Supabase.
-- Rode este arquivo inteiro no SQL Editor do projeto. Pode rodar de novo depois de mudanças:
-- ele só cria o que falta e atualiza as funções.
--
-- Quem pode o quê:
--   visitante: vê o estoque e a ocupação das malas (sem dados pessoais), faz reservas e
--              mexe só nas próprias, pela chave que o navegador guarda ou pela conta;
--   equipe:    e-mails da tabela staff; vê e administra todas as reservas e o estoque.
-- O pagamento continua simulado no site.

create extension if not exists pgcrypto;

/* ---------- Tabelas ---------- */

create table if not exists public.units (
  id text primary key,
  model_id text not null,
  color text not null,
  acquired_at date not null,
  maintenance boolean not null default false,
  note text
);

-- O pedido inteiro fica em data (o mesmo formato do site); as colunas ao lado são
-- preenchidas por gatilho, para buscar e conferir conflitos sem abrir o JSON.
create table if not exists public.orders (
  code text primary key,
  data jsonb not null,
  status text not null default 'aguardando_pagamento',
  start_date date not null,
  end_date date not null,
  email text not null default '',
  unit_ids text[] not null default '{}',
  expires_at timestamptz,
  source text not null default 'site',
  user_id uuid references auth.users (id) on delete set null,
  access_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_email_idx on public.orders (email);
create index if not exists orders_period_idx on public.orders (start_date, end_date);

-- Espelho sem dados pessoais: só o que o site precisa para saber quais malas estão livres.
create table if not exists public.holds (
  code text primary key references public.orders (code) on delete cascade,
  status text not null,
  start_date date not null,
  end_date date not null,
  unit_ids text[] not null,
  expires_at timestamptz
);

create table if not exists public.messages (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff (
  email text primary key
);

/* ---------- Gatilhos ---------- */

create or replace function public.orders_fill() returns trigger
language plpgsql set search_path = public as $$
begin
  new.status := coalesce(new.data->>'status', 'aguardando_pagamento');
  new.start_date := (new.data->>'start')::date;
  new.end_date := (new.data->>'end')::date;
  new.email := lower(coalesce(new.data->'customer'->>'email', ''));
  new.unit_ids := array(
    select jsonb_array_elements_text(i->'unitIds')
    from jsonb_array_elements(coalesce(new.data->'items', '[]'::jsonb)) i
  );
  new.expires_at := nullif(new.data->'payment'->>'expiresAt', '')::timestamptz;
  new.source := coalesce(new.data->>'source', 'site');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_fill on public.orders;
create trigger orders_fill before insert or update on public.orders
for each row execute function public.orders_fill();

create or replace function public.orders_mirror() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into holds (code, status, start_date, end_date, unit_ids, expires_at)
  values (new.code, new.status, new.start_date, new.end_date, new.unit_ids, new.expires_at)
  on conflict (code) do update set
    status = excluded.status, start_date = excluded.start_date, end_date = excluded.end_date,
    unit_ids = excluded.unit_ids, expires_at = excluded.expires_at;
  return null;
end $$;

drop trigger if exists orders_mirror on public.orders;
create trigger orders_mirror after insert or update on public.orders
for each row execute function public.orders_mirror();

/* ---------- Regras de negócio ---------- */

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where email = lower(coalesce(auth.jwt()->>'email', '')));
$$;

create or replace function public.today_sp() returns date
language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Alguma dessas malas já está com outra reserva nesse período? Conta o dia de higienização
-- depois de cada devolução e ignora reservas canceladas ou com o Pix vencido.
create or replace function public.units_busy(p_units text[], p_start date, p_end date, p_except text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from orders o
    where o.code <> coalesce(p_except, '')
      and o.status <> 'cancelado'
      and not (o.status = 'aguardando_pagamento' and o.expires_at is not null and o.expires_at <= now())
      and o.unit_ids && p_units
      and p_start <= o.end_date + 1
      and o.start_date <= p_end + 1
  );
$$;

-- Nova reserva. Confere de novo, já no banco, se as malas continuam livres.
create or replace function public.place_order(p_order jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(p_order->>'code');
  v_start date := (p_order->>'start')::date;
  v_end date := (p_order->>'end')::date;
  v_units text[] := array(
    select jsonb_array_elements_text(i->'unitIds')
    from jsonb_array_elements(coalesce(p_order->'items', '[]'::jsonb)) i
  );
  v_row orders;
begin
  if v_code is null or v_code !~ '^LG[A-Z0-9]{5}$' then raise exception 'LUGGO_INVALIDO'; end if;
  if p_order->>'status' is distinct from 'aguardando_pagamento' then raise exception 'LUGGO_INVALIDO'; end if;
  if v_start is null or v_end is null or v_end <= v_start or v_start < today_sp() then raise exception 'LUGGO_DATAS'; end if;
  if cardinality(v_units) = 0
     or cardinality(v_units) <> (select count(*) from units where id = any(v_units) and not maintenance) then
    raise exception 'LUGGO_CONFLITO';
  end if;
  -- Uma reserva por vez: duas pessoas não levam a mesma mala para as mesmas datas.
  lock table orders in share row exclusive mode;
  if units_busy(v_units, v_start, v_end, null) then raise exception 'LUGGO_CONFLITO'; end if;
  if exists (select 1 from orders where code = v_code) then raise exception 'LUGGO_CODIGO'; end if;
  insert into orders (code, data, user_id)
  values (v_code, p_order || jsonb_build_object('code', v_code, 'source', 'site'), auth.uid())
  returning * into v_row;
  return jsonb_build_object('order', v_row.data, 'key', v_row.access_key);
end $$;

-- Salva uma mudança no pedido. A equipe pode tudo; o cliente só paga, cancela no prazo,
-- troca a forma de pagamento ou estende o aluguel (com as mesmas malas livres).
create or replace function public.save_order(p_code text, p_key uuid, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old orders;
  v_status text := p_data->>'status';
  v_end date := (p_data->>'end')::date;
  v_free text[] := array['status', 'payment', 'history', 'extensions', 'end', 'returnReminder'];
begin
  select * into v_old from orders where code = upper(p_code) for update;
  if not found then raise exception 'LUGGO_NAO_ENCONTRADO'; end if;
  if v_end is null then raise exception 'LUGGO_INVALIDO'; end if;

  if not is_staff() then
    if not ((p_key is not null and v_old.access_key = p_key)
         or (auth.uid() is not null and (v_old.user_id = auth.uid() or v_old.email = lower(coalesce(auth.jwt()->>'email', ''))))) then
      raise exception 'LUGGO_SEM_ACESSO';
    end if;
    if (p_data - v_free) is distinct from (v_old.data - v_free) then raise exception 'LUGGO_INVALIDO'; end if;
    if v_status is distinct from v_old.status and not (
         (v_old.status = 'aguardando_pagamento' and v_status in ('confirmado', 'cancelado'))
      or (v_old.status = 'confirmado' and v_status = 'cancelado'
          and (v_old.start_date + time '12:00') - (now() at time zone 'America/Sao_Paulo') >= interval '48 hours')
    ) then
      raise exception 'LUGGO_INVALIDO';
    end if;
    if v_old.status = 'aguardando_pagamento' and v_status = 'confirmado' and v_old.expires_at <= now() then
      raise exception 'LUGGO_EXPIRADO';
    end if;
    if v_end < v_old.end_date then raise exception 'LUGGO_INVALIDO'; end if;
    if v_end > v_old.end_date and v_old.status not in ('confirmado', 'com_cliente') then raise exception 'LUGGO_INVALIDO'; end if;
  end if;

  if v_end > v_old.end_date then
    lock table orders in share row exclusive mode;
    if units_busy(v_old.unit_ids, v_old.end_date + 1, v_end, v_old.code) then raise exception 'LUGGO_CONFLITO'; end if;
  end if;

  update orders set data = p_data || jsonb_build_object('code', v_old.code) where code = v_old.code;
  return p_data || jsonb_build_object('code', v_old.code);
end $$;

-- Reservas do próprio cliente: as que este navegador fez (código + chave) e, com login,
-- todas feitas com o mesmo e-mail da conta.
create or replace function public.my_orders(p_refs jsonb default '[]'::jsonb)
returns table (data jsonb, key uuid)
language sql stable security definer set search_path = public as $$
  select o.data, o.access_key from orders o
  where exists (
          select 1 from jsonb_array_elements(coalesce(p_refs, '[]'::jsonb)) r
          where upper(r->>'code') = o.code and r->>'key' = o.access_key::text
        )
     or (auth.uid() is not null
         and (o.user_id = auth.uid() or o.email = lower(coalesce(auth.jwt()->>'email', ''))));
$$;

-- Busca por código e e-mail, como no e-mail de confirmação.
create or replace function public.find_order(p_code text, p_email text)
returns table (data jsonb, key uuid)
language sql stable security definer set search_path = public as $$
  select o.data, o.access_key from orders o
  where o.code = upper(trim(p_code)) and o.email = lower(trim(p_email)) and o.source = 'site';
$$;

-- Equipe: troca os pedidos de exemplo e devolve o estoque ao estado inicial.
-- As reservas feitas pelo site ficam como estão.
create or replace function public.reset_demo(p_units jsonb, p_orders jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'LUGGO_SEM_ACESSO'; end if;
  delete from orders where source = 'demo';
  insert into units (id, model_id, color, acquired_at, maintenance, note)
  select u->>'id', u->>'modelId', u->>'color', (u->>'acquiredAt')::date,
         coalesce((u->>'maintenance')::boolean, false), u->>'note'
  from jsonb_array_elements(p_units) u
  on conflict (id) do update set
    model_id = excluded.model_id, color = excluded.color, acquired_at = excluded.acquired_at,
    maintenance = excluded.maintenance, note = excluded.note;
  insert into orders (code, data)
  select o->>'code', o || jsonb_build_object('source', 'demo')
  from jsonb_array_elements(p_orders) o
  where not exists (select 1 from orders x where x.code = o->>'code')
    and not units_busy(
      array(select jsonb_array_elements_text(i->'unitIds') from jsonb_array_elements(o->'items') i),
      (o->>'start')::date, (o->>'end')::date, null
    );
end $$;

/* ---------- Acesso (RLS) ---------- */

alter table public.units enable row level security;
alter table public.orders enable row level security;
alter table public.holds enable row level security;
alter table public.messages enable row level security;
alter table public.staff enable row level security;

drop policy if exists "estoque visivel" on public.units;
create policy "estoque visivel" on public.units for select using (true);
drop policy if exists "equipe edita estoque" on public.units;
create policy "equipe edita estoque" on public.units for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "equipe ve pedidos" on public.orders;
create policy "equipe ve pedidos" on public.orders for select using (public.is_staff());
drop policy if exists "equipe apaga pedidos" on public.orders;
create policy "equipe apaga pedidos" on public.orders for delete using (public.is_staff());

drop policy if exists "ocupacao visivel" on public.holds;
create policy "ocupacao visivel" on public.holds for select using (true);

drop policy if exists "qualquer um escreve" on public.messages;
create policy "qualquer um escreve" on public.messages for insert with check (true);
drop policy if exists "equipe le mensagens" on public.messages;
create policy "equipe le mensagens" on public.messages for select using (public.is_staff());

grant execute on function public.is_staff(), public.place_order(jsonb), public.save_order(text, uuid, jsonb),
  public.my_orders(jsonb), public.find_order(text, text), public.reset_demo(jsonb, jsonb)
  to anon, authenticated;

/* ---------- Tempo real: o painel e o estoque se atualizam sozinhos ---------- */

do $$ begin
  alter publication supabase_realtime add table public.holds;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.units;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;

/* ---------- Equipe ----------
   Depois de rodar o arquivo, crie o usuário da equipe em Authentication > Users > Add user
   (e-mail e senha) e libere o acesso dele ao painel, trocando o e-mail abaixo:

   insert into public.staff (email) values ('email-da-equipe@exemplo.com');
*/
