-- ==============================================================================
-- PARTE 2: COMPLEMENTOS (FUNÇÕES QUE FALTARAM NO V1)
-- Rode isto LOGO DEPOIS do rebuild_database_v1.sql
-- ==============================================================================

-- 1. FUNÇÃO DE FORMATAR TELEFONE (BR)
CREATE OR REPLACE FUNCTION public.format_brazilian_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_phone text;
  v_ddd text;
  v_number text;
BEGIN
  -- Remove non-digits
  v_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  
  -- Add country code if missing
  IF NOT v_phone LIKE '55%' THEN
    v_phone := '55' || v_phone;
  END IF;
  
  -- Extract DDD and number (after country code)
  v_ddd := substring(v_phone from 3 for 2);
  v_number := substring(v_phone from 5);
  
  -- If mobile number has 8 digits (missing the 9), add it
  IF length(v_number) = 8 AND v_number ~ '^[6-9]' THEN
    v_number := '9' || v_number;
  END IF;
  
  RETURN '55' || v_ddd || v_number;
END;
$$;

-- 2. FUNÇÃO DE DISTRIBUIÇÃO (ROUND ROBIN)
CREATE OR REPLACE FUNCTION public.get_next_assigned_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_next_user_id uuid;
  v_user_count integer;
  v_next_index integer;
BEGIN
  -- Check if distribution is enabled
  SELECT enabled, last_assigned_index INTO v_config
  FROM lead_distribution_config
  LIMIT 1;
  
  IF v_config IS NULL OR NOT v_config.enabled THEN
    RETURN NULL;
  END IF;
  
  -- Count active users in distribution
  SELECT COUNT(*) INTO v_user_count
  FROM lead_distribution
  WHERE is_active = true;
  
  IF v_user_count = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Calculate next index (round-robin)
  v_next_index := (COALESCE(v_config.last_assigned_index, 0) % v_user_count) + 1;
  
  -- Get user at that position
  SELECT user_id INTO v_next_user_id
  FROM lead_distribution
  WHERE is_active = true
  ORDER BY position, created_at
  OFFSET (v_next_index - 1)
  LIMIT 1;
  
  -- Update last assigned index
  IF v_next_user_id IS NOT NULL THEN
    UPDATE lead_distribution_config
    SET last_assigned_index = v_next_index, updated_at = now();
  END IF;
  
  RETURN v_next_user_id;
END;
$$;

-- 3. FUNÇÃO DO WEBHOOK (CRUCIAL PARA O N8N)
CREATE OR REPLACE FUNCTION public.upsert_lead_from_webhook(p_phone text, p_name text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id uuid;
  v_formatted_phone text;
  v_assigned_user uuid;
BEGIN
  -- Format phone number
  v_formatted_phone := format_brazilian_phone(p_phone);
  
  -- Check if lead already exists
  SELECT id INTO v_lead_id FROM leads WHERE phone = v_formatted_phone;
  
  IF v_lead_id IS NULL THEN
    -- New lead - get next user from round-robin
    v_assigned_user := get_next_assigned_user();
    
    INSERT INTO leads (phone, name, status, assigned_to)
    VALUES (v_formatted_phone, COALESCE(p_name, v_formatted_phone), 'novo', v_assigned_user)
    RETURNING id INTO v_lead_id;
  ELSE
    -- Existing lead - just update timestamp
    UPDATE leads SET updated_at = now() WHERE id = v_lead_id;
  END IF;
  
  RETURN v_lead_id;
END;
$$;

-- 4. POLÍTICA DE DELETAR (Que faltou para Admin)
CREATE POLICY "Only admins can delete leads" ON public.leads
FOR DELETE USING (has_role(auth.uid(), 'admin'::public.app_role));

-- 5. CONFIRMAÇÃO DE REALTIME (Garantia)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
