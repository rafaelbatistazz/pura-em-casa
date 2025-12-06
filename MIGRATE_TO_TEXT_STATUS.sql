-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA PARA TEXT (FIM DOS ERROS DE ENUM)
-- OBJETIVO: Converter coluna status para TEXT livre e aplicar funil da Joalheria.
-- ==============================================================================

BEGIN;

-- 1. CONVERTER COLUNA PARA TEXTO (Remove dependência de TYPE)
-- Isso permite qualquer valor, evitando erros de "Type not found" ou "Value not in enum".
ALTER TABLE public.leads 
ALTER COLUMN status TYPE text;

-- 2. DROPAR O TIPO ANTIGO (SE EXISTIR) PARA LIMPEZA
DROP TYPE IF EXISTS public.lead_status;

-- 3. ATUALIZAR STATUS PARA O NOVO FUNIL (JOALHERIA)
-- Mapeamento inteligente dos dados existentes

-- 'novo' -> 'Novos Leads'
UPDATE public.leads SET status = 'Novos Leads' WHERE status = 'novo';

-- 'qualificando' -> 'Qualificação'
UPDATE public.leads SET status = 'Qualificação' WHERE status = 'qualificando' OR status = 'Qualificando';

-- 'reuniao' -> 'Apresentação' (Showroom)
UPDATE public.leads SET status = 'Apresentação' WHERE status = 'reuniao' OR status = 'Reunião';

-- 'aguardando' -> 'Follow-up'
UPDATE public.leads SET status = 'Follow-up' WHERE status = 'aguardando' OR status = 'Aguardando';

-- 'proposta' / 'viabilidade' -> 'Negociação'
UPDATE public.leads SET status = 'Negociação' WHERE status IN ('proposta', 'viabilidade', 'Proposta', 'Viabilidade');

-- 'procuracao' -> 'Produção' (Chute educado)
UPDATE public.leads SET status = 'Produção' WHERE status IN ('procuracao', 'Procuração');

-- 'ganho' -> 'Vendido'
UPDATE public.leads SET status = 'Vendido' WHERE status = 'ganho' OR status = 'Ganho';

-- 'perdido' -> Mantemos como 'Perdido' (ou Arquivado?) - Vamos manter Perdido por enquanto.
-- Se houver status desconhecido, joga para 'Novos Leads'
UPDATE public.leads SET status = 'Novos Leads' WHERE status NOT IN (
    'Novos Leads', 'Qualificação', 'Apresentação', 'Follow-up', 
    'Negociação', 'Aguardar Pagamento', 'Produção', 'Pronto para Entrega', 
    'Vendido', 'Pós-Venda', 'Perdido'
);

COMMIT;
