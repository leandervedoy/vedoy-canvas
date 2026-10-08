create table if not exists users (
  id text primary key,
  email text not null unique,
  name text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists oauth_sessions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  expires_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists canvas_workspaces (
  user_id text primary key references users (id) on delete cascade,
  snapshot_json text not null default '{}',
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists canvas_books (
  id text primary key,
  owner_id text not null references users (id) on delete cascade,
  title text not null,
  data_json text not null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists canvas_book_members (
  book_id text not null references canvas_books (id) on delete cascade,
  owner_id text not null references users (id) on delete cascade,
  invitee_email text not null,
  role text not null check (role in ('viewer', 'editor')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (book_id, invitee_email)
);

create index if not exists idx_canvas_books_owner on canvas_books (owner_id, updated_at);
create index if not exists idx_canvas_book_members_email on canvas_book_members (invitee_email);
create index if not exists idx_oauth_sessions_access_token_hash on oauth_sessions (access_token_hash);
