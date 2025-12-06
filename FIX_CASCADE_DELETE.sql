-- ==============================================================================
-- FIX CASCADE DELETE (CORREÇÃO DE EXCLUSÃO)
-- OBJETIVO: Permitir apagar leads mesmo que tenham mensagens.
-- O padrão atual bloqueia delete se tiver mensagens (FK constraint).
-- ==============================================================================

BEGIN;

-- 1. DROPAR FK ANTIGA DA TABELA MESSAGES
ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_lead_id_fkey;

-- 2. CRIAR NOVA FK COM CASCADE DELETE
ALTER TABLE public.messages
ADD CONSTRAINT messages_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES public.leads(id)
ON DELETE CASCADE;

-- Fazer o mesmo para outras tabelas que possam travar?
-- Ex: lead_distribution_logs (se existir e apontar para lead)
-- Por via das dúvidas, vamos focar no messages que é o principal.

COMMIT;
