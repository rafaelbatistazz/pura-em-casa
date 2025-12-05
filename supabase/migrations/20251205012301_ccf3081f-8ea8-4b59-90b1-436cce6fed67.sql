-- Fix format_brazilian_phone with search_path
CREATE OR REPLACE FUNCTION public.format_brazilian_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
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
$function$;

-- Fix upsert_lead_from_webhook with search_path
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
BEGIN
  -- Format phone number
  v_formatted_phone := public.format_brazilian_phone(p_phone);
  
  -- Check if lead already exists
  SELECT id INTO v_lead_id FROM public.leads WHERE phone = v_formatted_phone;
  
  IF v_lead_id IS NULL THEN
    -- New lead - get next user from round-robin
    v_assigned_user := public.get_next_assigned_user();
    
    INSERT INTO public.leads (phone, name, status, assigned_to)
    VALUES (v_formatted_phone, COALESCE(p_name, v_formatted_phone), 'novo', v_assigned_user)
    RETURNING id INTO v_lead_id;
  ELSE
    -- Existing lead - just update timestamp
    UPDATE public.leads SET updated_at = now() WHERE id = v_lead_id;
  END IF;
  
  RETURN v_lead_id;
END;
$function$;