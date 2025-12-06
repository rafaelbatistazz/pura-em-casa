-- ==============================================================================
-- ATUALIZAÇÃO KANBAN (V10) - NOVAS ETAPAS COMERCIAIS
-- ==============================================================================

-- Adicionar novos valores ao ENUM 'lead_status'
-- (Executamos um por um para evitar erro de transação em enums)

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'oportunidade';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'qualificando';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'viabilidade';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'proposta';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'procuracao';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'reuniao';

-- Opcional: Migrar leads antigos 'novo' para 'oportunidade'
-- UPDATE public.leads SET status = 'oportunidade' WHERE status = 'novo';
