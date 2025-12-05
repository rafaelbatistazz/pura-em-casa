-- Alterar a tabela messages para usar TIMESTAMP WITH TIME ZONE
-- Isso garante que o Supabase respeite o offset -03:00 enviado pelo front/webhook

BEGIN;

  -- 1. Alterar o tipo da coluna (assumindo que o que está lá foi salvo como UTC)
  ALTER TABLE public.messages 
  ALTER COLUMN timestamp TYPE timestamp with time zone 
  USING timestamp AT TIME ZONE 'UTC';

  -- 2. Garantir que o default seja o momento atual COM fuso
  ALTER TABLE public.messages 
  ALTER COLUMN timestamp SET DEFAULT now();

COMMIT;
