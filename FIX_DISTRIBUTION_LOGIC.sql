-- ==============================================================================
-- FIX DISTRIBUTION LOGIC (ROBÔ DE DISTRIBUIÇÃO)
-- OBJETIVO: Atualizar a função que distribui leads para olhar a tabela nova (app_profiles).
-- ==============================================================================

-- 1. RECRIAR A FUNÇÃO get_next_assigned_user
-- Essa função decide para quem vai o próximo lead.
-- Antes ela olhava 'users', agora vai olhar 'lead_distribution' + 'app_profiles'.

CREATE OR REPLACE FUNCTION public.get_next_assigned_user()
RETURNS uuid AS $$
DECLARE
  v_next_user_id uuid;
  v_last_index integer;
  v_count_active integer;
BEGIN
  -- Verificar se distribuição está ativa
  IF NOT EXISTS (SELECT 1 FROM public.lead_distribution_config WHERE enabled = true) THEN
    RETURN NULL;
  END IF;

  -- Contar usuários ativos na fila
  SELECT count(*) INTO v_count_active FROM public.lead_distribution WHERE is_active = true;
  
  IF v_count_active = 0 THEN
    RETURN NULL;
  END IF;

  -- Pegar o ultimo índice usado
  SELECT last_assigned_index INTO v_last_index FROM public.lead_distribution_config LIMIT 1;
  IF v_last_index IS NULL THEN 
    v_last_index := -1; 
  END IF;

  -- Calcular próximo índice (Round Robin)
  -- Ex: Se tem 3 users (indices 0, 1, 2) e o ultimo foi 0, o proximo é 1.
  -- Se o ultimo foi 2, (2+1) % 3 = 0.
  v_last_index := (v_last_index + 1) % v_count_active;

  -- Pegar o ID do usuário nessa posição
  SELECT user_id INTO v_next_user_id 
  FROM public.lead_distribution 
  WHERE is_active = true 
  ORDER BY position ASC 
  OFFSET v_last_index LIMIT 1;

  -- Atualizar o índice para a próxima vez
  UPDATE public.lead_distribution_config SET last_assigned_index = v_last_index;

  RETURN v_next_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. TRIGGER PARA DISTRIBUIR AUTOMATICAMENTE (NO LEAD NOVO)
CREATE OR REPLACE FUNCTION public.handle_new_lead_distribution()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned_user uuid;
BEGIN
  -- Se já veio com dono, ignora
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tenta pegar o próximo da fila
  v_assigned_user := public.get_next_assigned_user();

  -- Se achou alguém, atribui
  IF v_assigned_user IS NOT NULL THEN
    NEW.assigned_to := v_assigned_user;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reativar o Trigger na tabela LEADS
DROP TRIGGER IF EXISTS on_lead_created_distribute ON public.leads;
CREATE TRIGGER on_lead_created_distribute
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_lead_distribution();

-- 3. GARANTIR PERMISSÕES
GRANT EXECUTE ON FUNCTION public.get_next_assigned_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_assigned_user TO service_role;
