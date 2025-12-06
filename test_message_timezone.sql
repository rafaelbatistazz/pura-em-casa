-- ==============================================================================
-- SCRIPT DE TESTE: TIMEZONE DE MENSAGENS
-- Verifica se o horário do servidor (now()) está sendo salvo corretamente.
-- ==============================================================================

DO $$
DECLARE
  v_lead_id uuid;
BEGIN
  -- 1. Buscar o Lead de Teste criado anteriormente
  SELECT id INTO v_lead_id FROM public.leads WHERE phone = '5511999999999';

  -- 2. Se achar, inserir uma mensagem de teste
  IF v_lead_id IS NOT NULL THEN
    INSERT INTO public.messages (lead_id, phone, message_text, direction, sender_name, timestamp)
    VALUES (
      v_lead_id, 
      '5511999999999', 
      'Teste Timezone SQL (Server Time): ' || to_char(now(), 'HH24:MI:SS'), 
      'inbound', 
      'Teste Sistema', 
      now() -- Importante: Usar o now() do banco para validar a config
    );
  END IF;
END $$;
