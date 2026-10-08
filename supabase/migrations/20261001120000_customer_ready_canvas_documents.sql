create table if not exists public.canvas_documents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.canvas_documents enable row level security;

revoke all on table public.canvas_documents from anon;
grant select, insert, update, delete on table public.canvas_documents to authenticated;

drop policy if exists "Users can view their canvas document" on public.canvas_documents;
create policy "Users can view their canvas document"
on public.canvas_documents for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their canvas document" on public.canvas_documents;
create policy "Users can create their canvas document"
on public.canvas_documents for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their canvas document" on public.canvas_documents;
create policy "Users can update their canvas document"
on public.canvas_documents for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their canvas document" on public.canvas_documents;
create policy "Users can delete their canvas document"
on public.canvas_documents for delete
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.canvas_documents is 'Private Vedoy Canvas workspace snapshots, one row per authenticated customer.';
