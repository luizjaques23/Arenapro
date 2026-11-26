-- Execute este SQL no SQL Editor do seu projeto Supabase para ativar o acompanhamento público em tempo real entre celulares diferentes:
create table if not exists public.tournaments (
  id text primary key,
  public_token text,
  public_status text not null default 'ativo' check (public_status in ('ativo', 'encerrado')),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.tournaments enable row level security;

-- Leitura pública apenas pelo ID/link de acompanhamento (somente leitura)
create policy "Public read tournaments"
  on public.tournaments
  for select
  using (true);

-- Escrita pelo app organizador (caso use anon key sem auth)
create policy "Organizer upsert tournaments"
  on public.tournaments
  for insert
  with check (true);

create policy "Organizer update tournaments"
  on public.tournaments
  for update
  using (true);
