CREATE OR REPLACE FUNCTION public.upsert_lead_from_webhook(p_phone text, p_name text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_lead_id uuid;
  v_formatted_phone text;
  v_assigned_user uuid;
  v_default_ai_enabled boolean;
  v_default_followup_enabled boolean;
BEGIN
  -- 1. Normalize input phone
  v_formatted_phone := public.format_brazilian_phone(p_phone);
  
  -- 2. Smart Search: Check if ANY phone in DB matches this normalized version
  SELECT id INTO v_lead_id 
  FROM public.leads 
  WHERE public.format_brazilian_phone(phone) = v_formatted_phone
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_lead_id IS NULL THEN
    -- New lead
    
    -- Fetch default settings
    SELECT (value::boolean) INTO v_default_ai_enabled
    FROM system_config WHERE key = 'default_ai_enabled';
    
    SELECT (value::boolean) INTO v_default_followup_enabled
    FROM system_config WHERE key = 'default_followup_enabled';
    
    -- Defaults if not set
    v_default_ai_enabled := COALESCE(v_default_ai_enabled, false);
    v_default_followup_enabled := COALESCE(v_default_followup_enabled, false);

    -- Get next user
    v_assigned_user := public.get_next_assigned_user();
    
    -- Insert with 'Oportunidade' status and default settings
    INSERT INTO public.leads (
      phone, 
      name, 
      status, 
      assigned_to, 
      ai_enabled, 
      followup_enabled
    )
    VALUES (
      v_formatted_phone, 
      COALESCE(p_name, v_formatted_phone), 
      'Oportunidade',  -- Changed from 'novo' to 'Oportunidade'
      v_assigned_user,
      v_default_ai_enabled,
      v_default_followup_enabled
    )
    RETURNING id INTO v_lead_id;
  ELSE
    -- Existing lead found
    -- Update phone format for creating consistency
    UPDATE public.leads 
    SET 
      updated_at = now(),
      phone = v_formatted_phone
    WHERE id = v_lead_id;
  END IF;
  
  RETURN v_lead_id;
END;
$function$;
