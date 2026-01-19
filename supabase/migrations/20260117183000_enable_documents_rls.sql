
-- Enable RLS on documents table
alter table "public"."documents" enable row level security;

-- Create policy to allow all actions for authenticated users
create policy "Enable all access for authenticated users"
on "public"."documents"
as permissive
for all
to authenticated
using (true)
with check (true);
