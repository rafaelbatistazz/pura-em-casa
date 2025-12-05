-- Adicionar RLS em system_config
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Permitir admins gerenciar todas as configs
CREATE POLICY "Admins can manage system_config"
ON public.system_config
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Permitir todos autenticados lerem as configs
CREATE POLICY "Authenticated users can read system_config"
ON public.system_config
FOR SELECT
USING (auth.uid() IS NOT NULL);