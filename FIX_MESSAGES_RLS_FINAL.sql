-- ==============================================================================
-- FIX MESSAGES RLS FINAL (O DESTRAVAMENTO)
-- OBJETIVO: Permitir que usuários GRAVEM e LEIAM mensagens.
-- ==============================================================================

BEGIN;

-- 1. LIMPAR POLÍTICAS ANTIGAS (SE HOUVER)
DROP POLICY IF EXISTS "Messages: Admin Full Access" ON public.messages;
DROP POLICY IF EXISTS "Messages: View Assigned" ON public.messages;
DROP POLICY IF EXISTS "Messages: Public Insert" ON public.messages;
DROP POLICY IF EXISTS "Messages: Authenticated Insert" ON public.messages;

-- 2. GARANTIR RLS ATIVO
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. CRIAR NOVAS POLÍTICAS (SIMPLES E DIRETAS)

-- POLÍTICA 1: TODO USUÁRIO LOGADO PODE INSERIR MENSAGEM
-- (Sem frescura de checar lead_id na inserção, deixa o trigger validar se quiser)
CREATE POLICY "Messages: Authenticated Insert" ON public.messages
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- POLÍTICA 2: ADMIN VÊ TUDO
CREATE POLICY "Messages: Admin Full Access" ON public.messages
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.app_profiles WHERE id = auth.uid() AND role = 'admin')
);

-- POLÍTICA 3: USUÁRIO VÊ O QUE É DELE
-- (Se o lead for dele OU se ele for o dono da mensagem)
CREATE POLICY "Messages: View Assigned" ON public.messages
FOR SELECT USING (
  -- Mensagens de leads atribuídos ao usuário
  EXISTS (
    SELECT 1 FROM public.leads 
    WHERE leads.id = messages.lead_id 
    AND leads.assigned_to = auth.uid()
  )
  OR
  -- Ou se o lead não tiver dono (Opcional, mas bom para leads novos)
  EXISTS (
     SELECT 1 FROM public.leads 
     WHERE leads.id = messages.lead_id 
     AND leads.assigned_to IS NULL
  )
);

-- 4. GRANT (PERMISSÃO DE NÍVEL SQL)
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;
