-- Create table for Kanban columns configuration
-- SAFE: It only creates the table if it does not exist. Existing data is not touched.
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id text NOT NULL UNIQUE, -- The programmatic ID (e.g., 'Novos Leads')
  title text NOT NULL, -- The display name (e.g., 'Novos Leads')
  color text, -- CSS classes for styling
  position integer NOT NULL, -- To control display order
  usage_limit integer DEFAULT 0, -- Optional: limit leads per column
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
-- SAFE: Enabling RLS forces policies to be checked.
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read columns
-- SAFE: Uses DROP IF EXISTS to avoid errors on re-runs.
-- SAFE: Allows all users (including anon) to view columns, ensuring UI never breaks.
DROP POLICY IF EXISTS "Everyone can view kanban columns" ON public.kanban_columns;
CREATE POLICY "Everyone can view kanban columns" 
ON public.kanban_columns FOR SELECT 
USING (true);

-- Policy: Only admins can insert/update/delete
-- SAFE: Strict check against app_profiles for 'admin' role.
DROP POLICY IF EXISTS "Admins can manage kanban columns" ON public.kanban_columns;
CREATE POLICY "Admins can manage kanban columns" 
ON public.kanban_columns FOR ALL 
USING (
  exists (
    select 1 from public.app_profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- Seed initial data
-- SAFE: Uses ON CONFLICT DO NOTHING to prevent duplicate errors or overwriting existing customizations.
INSERT INTO public.kanban_columns (status_id, title, color, position) VALUES
  ('Novos Leads', 'Novos Leads', 'bg-slate-500/20 text-slate-400', 0),
  ('Qualificação', 'Qualificação', 'bg-yellow-500/20 text-yellow-400', 1),
  ('Apresentação', 'Apresentação / Showroom', 'bg-blue-500/20 text-blue-400', 2),
  ('Follow-up', 'Follow-up', 'bg-orange-500/20 text-orange-400', 3),
  ('Negociação', 'Negociação / Orçamento', 'bg-purple-500/20 text-purple-400', 4),
  ('Aguardar Pagamento', 'Aguardar Pagamento', 'bg-pink-500/20 text-pink-400', 5),
  ('Produção', 'Produção / Ajustes', 'bg-indigo-500/20 text-indigo-400', 6),
  ('Pronto para Entrega', 'Pronto para Entrega', 'bg-teal-500/20 text-teal-400', 7),
  ('Vendido', 'Vendido / Entregue', 'bg-emerald-500/20 text-emerald-400', 8),
  ('Pós-Venda', 'Pós-Venda (LTV)', 'bg-cyan-500/20 text-cyan-400', 9),
  ('Perdido', 'Perdido', 'bg-red-500/20 text-red-500', 10)
ON CONFLICT (status_id) DO NOTHING;
