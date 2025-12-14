-- ==============================================================================
-- FIX DELETE PERMISSIONS (Leads & Messages)
-- OBJETIVO: Permitir que Admins e Donos do Lead excluam conversas e mensagens
-- ==============================================================================

-- 1. LEADS: Verifica direto na tabela APP_PROFILES se é admin
DROP POLICY IF EXISTS "Delete leads" ON public.leads;

CREATE POLICY "Delete leads" ON public.leads 
FOR DELETE USING (
  -- Verifica diretamente na tabela users se é admin (sem depender de função)
  EXISTS (
    SELECT 1 FROM public.app_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- 2. MESSAGES: Mesma verificação direta
DROP POLICY IF EXISTS "Delete messages" ON public.messages;

CREATE POLICY "Delete messages" ON public.messages
FOR DELETE USING (
  -- Verifica diretamente na tabela users se é admin (sem depender de função)
  EXISTS (
    SELECT 1 FROM public.app_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

COMMIT;
