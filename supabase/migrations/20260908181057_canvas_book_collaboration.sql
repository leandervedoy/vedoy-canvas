create table public.canvas_books (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.canvas_book_members (
  book_id text not null,
  owner_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  invitee_email text not null check (invitee_email = lower(invitee_email)),
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (book_id, invitee_email),
  foreign key (book_id, owner_id) references public.canvas_books (id, owner_id) on delete cascade
);

create index canvas_books_owner_id_idx on public.canvas_books using btree (owner_id);
create index canvas_book_members_user_id_idx on public.canvas_book_members using btree (user_id);
create index canvas_book_members_invitee_email_idx on public.canvas_book_members using btree (lower(invitee_email));

alter table public.canvas_books enable row level security;
alter table public.canvas_book_members enable row level security;

revoke all on table public.canvas_books from anon, authenticated;
revoke all on table public.canvas_book_members from anon, authenticated;
grant select, insert, delete on table public.canvas_books to authenticated;
grant update (title, data, updated_at) on table public.canvas_books to authenticated;
grant select, insert, update, delete on table public.canvas_book_members to authenticated;

create policy "Owners and members can view books"
on public.canvas_books for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or exists (
    select 1
    from public.canvas_book_members member
    where member.book_id = canvas_books.id
      and (
        member.user_id = (select auth.uid())
        or lower(member.invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
);

create policy "Owners can create books"
on public.canvas_books for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners and editors can update books"
on public.canvas_books for update
to authenticated
using (
  (select auth.uid()) = owner_id
  or exists (
    select 1
    from public.canvas_book_members member
    where member.book_id = canvas_books.id
      and member.role = 'editor'
      and (
        member.user_id = (select auth.uid())
        or lower(member.invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
)
with check (
  (select auth.uid()) = owner_id
  or exists (
    select 1
    from public.canvas_book_members member
    where member.book_id = canvas_books.id
      and member.role = 'editor'
      and (
        member.user_id = (select auth.uid())
        or lower(member.invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      )
  )
);

create policy "Owners can delete books"
on public.canvas_books for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Members can view their membership"
on public.canvas_book_members for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select auth.uid()) = user_id
  or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy "Owners can invite members"
on public.canvas_book_members for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update invitations"
on public.canvas_book_members for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can remove members"
on public.canvas_book_members for delete
to authenticated
using ((select auth.uid()) = owner_id);

do $$
begin
  alter publication supabase_realtime add table public.canvas_books;
exception
  when duplicate_object then null;
end
$$;
