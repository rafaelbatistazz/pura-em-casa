-- ==============================================================================
-- FIX SHORTCUTS PERMISSIONS (CORREÇÃO DE ATALHOS)
-- ==============================================================================

BEGIN;

-- 1. HABILITAR RLS NA TABELA
ALTER TABLE public.message_shortcuts ENABLE ROW LEVEL SECURITY;

-- 2. LIMPAR POLICIES ANTIGAS (PREVENÇÃO)
DROP POLICY IF EXISTS "Shortcuts: Everyone Read" ON public.message_shortcuts;
DROP POLICY IF EXISTS "Shortcuts: Auth Manage" ON public.message_shortcuts;
DROP POLICY IF EXISTS "Shortcuts: Read" ON public.message_shortcuts;
DROP POLICY IF EXISTS "Shortcuts: Manage" ON public.message_shortcuts;

-- 3. CRIAR NOVAS POLICIES
-- Permitir que todos os usuários vejam e criem atalhos.
-- (Idealmente cada um veria o seu, mas em times pequenos é comum compartilhar)

-- LEITURA: Todos usuários autenticados podem ver
CREATE POLICY "Shortcuts: Read" 
ON public.message_shortcuts 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- ESCRITA (Insert, Update, Delete): Todos usuários autenticados podem gerenciar
CREATE POLICY "Shortcuts: Manage" 
ON public.message_shortcuts 
FOR ALL 
USING (auth.role() = 'authenticated');

COMMIT;
