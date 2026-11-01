-- =====================================================================
-- Explorador de Países — tabela e políticas de acesso (Supabase)
-- Cole tudo no SQL Editor do Supabase e clique em "Run".
-- =====================================================================

create table if not exists public.favoritos (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  nome_item   text        not null,          -- nome do país em português
  dados_extra jsonb       not null default '{}'::jsonb
  -- dados_extra guarda: codigo (cca3), bandeira, capital, regiao,
  --                     status ('visitado' | 'desejado'), anotacao
);

-- Liga o Row Level Security
alter table public.favoritos enable row level security;

-- Políticas ABERTAS para o papel anon (aceitas nesta etapa — limitação documentada no README)
create policy "anon pode ler"     on public.favoritos for select to anon using (true);
create policy "anon pode inserir" on public.favoritos for insert to anon with check (true);
create policy "anon pode editar"  on public.favoritos for update to anon using (true) with check (true);
create policy "anon pode excluir" on public.favoritos for delete to anon using (true);
