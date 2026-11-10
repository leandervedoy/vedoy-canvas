-- Vedoy Infinite Canvas: internal-only membership and decision engine.
-- Memberships are server-managed. No browser-write privileges are granted.
create table if not exists public.canvas_internal_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  membership text not null default 'vedoy-internal' check (membership = 'vedoy-internal'),
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  note text not null default ''
);
alter table public.canvas_internal_members enable row level security;
revoke all on public.canvas_internal_members from public, anon, authenticated;
grant select on public.canvas_internal_members to authenticated;
create policy "Internal members may read their own membership"
  on public.canvas_internal_members for select to authenticated
  using ((select auth.uid()) = user_id);

-- Bootstrap only the existing Canvas owner who already has a verified
-- Vedoy owner entitlement. Do not enroll other users automatically.
insert into public.canvas_internal_members (user_id, note)
select d.user_id, 'Bootstrap: existing Canvas workspace and Vedoy owner'
from public.canvas_documents d
join public.vedoy_admin_roles a on a.user_id = d.user_id and a.role::text = 'owner'
on conflict (user_id) do nothing;

create table if not exists public.canvas_decision_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '',
  category text not null default 'Vedøy Studio',
  status text not null default 'idea'
    check (status in ('idea', 'validate', 'approved', 'building', 'launched', 'parked')),
  reach numeric not null default 50 check (reach >= 0 and reach <= 1000000),
  impact numeric not null default 1 check (impact >= 0 and impact <= 3),
  confidence numeric not null default 40 check (confidence between 0 and 100),
  build_hours numeric not null default 24 check (build_hours >= 0 and build_hours <= 100000),
  monthly_hours numeric not null default 5 check (monthly_hours >= 0 and monthly_hours <= 100000),
  hourly_cost numeric not null default 250 check (hourly_cost >= 0 and hourly_cost <= 1000000),
  energy integer not null default 3 check (energy between 1 and 5),
  price_per_customer numeric not null default 500 check (price_per_customer >= 0 and price_per_customer <= 100000000),
  variable_cost_per_customer numeric not null default 100 check (variable_cost_per_customer >= 0 and variable_cost_per_customer <= 100000000),
  fixed_monthly_cost numeric not null default 500 check (fixed_monthly_cost >= 0 and fixed_monthly_cost <= 100000000),
  customers_low integer not null default 1 check (customers_low between 0 and 1000000),
  customers_base integer not null default 5 check (customers_base between 0 and 1000000),
  customers_high integer not null default 12 check (customers_high between 0 and 1000000),
  validation_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists canvas_decision_projects_owner_updated_idx
  on public.canvas_decision_projects (owner_id, updated_at desc);
alter table public.canvas_decision_projects enable row level security;
revoke all on public.canvas_decision_projects from public, anon, authenticated;
grant select, insert, update, delete on public.canvas_decision_projects to authenticated;

create policy "Internal owners manage own decisions"
on public.canvas_decision_projects for all to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
)
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
);

create table if not exists public.canvas_decision_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.canvas_decision_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists canvas_decision_tasks_project_idx
  on public.canvas_decision_tasks (project_id, created_at);
alter table public.canvas_decision_tasks enable row level security;
revoke all on public.canvas_decision_tasks from public, anon, authenticated;
grant select, insert, update, delete on public.canvas_decision_tasks to authenticated;

create policy "Internal owners manage own decision tasks"
on public.canvas_decision_tasks for all to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.canvas_decision_projects p
    where p.id = project_id and p.owner_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.canvas_decision_projects p
    where p.id = project_id and p.owner_id = (select auth.uid()))
);

-- Keep the existing ownership / collaboration rules, but require the internal
-- entitlement as an additional AND condition. Never add an open policy.
create policy "Canvas documents require internal membership"
on public.canvas_documents as restrictive for all to authenticated
using (
  exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
)
with check (
  exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
);
create policy "Canvas books require internal membership"
on public.canvas_books as restrictive for all to authenticated
using (
  exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
)
with check (
  exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
);
create policy "Canvas book sharing requires internal membership"
on public.canvas_book_members as restrictive for all to authenticated
using (
  exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
)
with check (
  exists (select 1 from public.canvas_internal_members m
    where m.user_id = (select auth.uid()) and m.active = true)
);

comment on table public.canvas_internal_members is
  'Server-managed Vedoy Internal Membership entitlement; never authorize via user_metadata.';
comment on table public.canvas_decision_projects is
  'Private Canvas Decision Engine projects. RLS requires owner and active internal membership.';
