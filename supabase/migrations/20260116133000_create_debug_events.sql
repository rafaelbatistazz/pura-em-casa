create table if not exists public.debug_events (
  id uuid default gen_random_uuid() primary key,
  event_type text,
  payload jsonb,
  created_at timestamp with time zone default now()
);

alter table public.debug_events enable row level security;

create policy "Enable insert for service role only" on public.debug_events
  for insert with check (true);

create policy "Enable select for authenticated users only" on public.debug_events
  for select using (true);
