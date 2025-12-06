-- ==============================================================================
-- JOALHERIA PIPELINE UPGRADE
-- Adiciona etapas específicas para o fluxo de joalheria.
-- ==============================================================================

BEGIN;

-- 1. ADICIONAR NOVOS VALORES AO ENUM
-- Note: Postgres nao permite remover valores de ENUM facilmente, então a gente adiciona os novos e ignora os velhos.

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'apresentacao';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'follow_up';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'negociacao';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'producao';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'pronto_entrega';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'vendido';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'pos_venda';

-- As colunas 'novo' e 'qualificando' (ou 'qualificacao') e 'perdido' vamos reutilizar ou manter.
-- 'novo' já existe.
-- 'qualificando' já existe (vamos usar ele como Qualificação).

-- 2. MIGRAR DADOS ANTIGOS PARA O NOVO FLUXO
-- Mapeamento aproximado para não perder leads de vista

-- 'reuniao' -> 'apresentacao'
UPDATE public.leads SET status = 'apresentacao' WHERE status = 'reuniao';

-- 'proposta' -> 'negociacao'
UPDATE public.leads SET status = 'negociacao' WHERE status = 'proposta';

-- 'viabilidade' -> 'negociacao'
UPDATE public.leads SET status = 'negociacao' WHERE status = 'viabilidade';

-- 'procuracao' -> 'producao' (chute educado, melhor que perder)
UPDATE public.leads SET status = 'producao' WHERE status = 'procuracao';

-- 'ganho' -> 'vendido'
UPDATE public.leads SET status = 'vendido' WHERE status = 'ganho';

COMMIT;
