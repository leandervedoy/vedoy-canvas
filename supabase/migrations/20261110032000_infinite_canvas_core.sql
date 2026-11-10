-- Vedøy Infinite Canvas core integration
-- Shared My Library, Developer Project workspaces, Marketplace visibility, and Realtime.

create table if not exists public.canvas_project_workspaces (
  project_id uuid primary key references public.developer_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb,
  updated_at timestamptz not null default now()
);

alter table public.canvas_project_workspaces enable row level security;
revoke all on table public.canvas_project_workspaces from anon, authenticated;
grant select, insert, update, delete on table public.canvas_project_workspaces to authenticated;

drop policy if exists "Owners manage project canvas workspaces" on public.canvas_project_workspaces;
create policy "Owners manage project canvas workspaces"
on public.canvas_project_workspaces for all to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.developer_projects p
    where p.id = canvas_project_workspaces.project_id
      and p.owner_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1 from public.developer_projects p
    where p.id = canvas_project_workspaces.project_id
      and p.owner_id = (select auth.uid())
  )
);

create table if not exists public.vedoy_library_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.developer_projects(id) on delete cascade,
  source_key text,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  kind text not null default 'component' check (kind in (
    'component','component-pack','code','template','api','forge-node','design','3d','media','game','document','other'
  )),
  visibility text not null default 'personal' check (visibility in ('personal','project','public')),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  compatibility text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  version integer not null default 1 check (version >= 1),
  price_coins integer not null default 0 check (price_coins >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((visibility = 'project' and project_id is not null) or visibility <> 'project')
);

create unique index if not exists vedoy_library_items_owner_source_key_uq
  on public.vedoy_library_items(owner_id, source_key);
create index if not exists vedoy_library_items_owner_updated_idx
  on public.vedoy_library_items(owner_id, updated_at desc);
create index if not exists vedoy_library_items_project_updated_idx
  on public.vedoy_library_items(project_id, updated_at desc)
  where project_id is not null;
create index if not exists vedoy_library_items_public_updated_idx
  on public.vedoy_library_items(updated_at desc)
  where visibility = 'public';

alter table public.vedoy_library_items enable row level security;
revoke all on table public.vedoy_library_items from anon, authenticated;
grant select on table public.vedoy_library_items to anon;
grant select, insert, update, delete on table public.vedoy_library_items to authenticated;

drop policy if exists "Public can browse marketplace library items" on public.vedoy_library_items;
create policy "Public can browse marketplace library items"
on public.vedoy_library_items for select to anon, authenticated
using (visibility = 'public');

drop policy if exists "Owners can read library items" on public.vedoy_library_items;
create policy "Owners can read library items"
on public.vedoy_library_items for select to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create library items" on public.vedoy_library_items;
create policy "Owners can create library items"
on public.vedoy_library_items for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and (
    project_id is null
    or exists (
      select 1 from public.developer_projects p
      where p.id = vedoy_library_items.project_id
        and p.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners can update library items" on public.vedoy_library_items;
create policy "Owners can update library items"
on public.vedoy_library_items for update to authenticated
using ((select auth.uid()) = owner_id)
with check (
  (select auth.uid()) = owner_id
  and (
    project_id is null
    or exists (
      select 1 from public.developer_projects p
      where p.id = vedoy_library_items.project_id
        and p.owner_id = (select auth.uid())
    )
  )
);

drop policy if exists "Owners can delete library items" on public.vedoy_library_items;
create policy "Owners can delete library items"
on public.vedoy_library_items for delete to authenticated
using ((select auth.uid()) = owner_id);

alter table public.canvas_books
  add column if not exists project_id uuid references public.developer_projects(id) on delete set null;

create index if not exists canvas_books_project_updated_idx
  on public.canvas_books(project_id, updated_at desc);

do $$
begin
  alter publication supabase_realtime add table public.canvas_project_workspaces;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.vedoy_library_items;
exception when duplicate_object then null;
end $$;
