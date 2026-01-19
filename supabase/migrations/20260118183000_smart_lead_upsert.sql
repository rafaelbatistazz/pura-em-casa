-- Update upsert_lead_from_webhook to handle formatted/legacy phones by normalizing on search
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
  -- 1. Normalize input phone (e.g. 5571981897865)
  v_formatted_phone := public.format_brazilian_phone(p_phone);
  
  -- 2. Smart Search: Check if ANY phone in DB matches this normalized version
  -- This handles:
  --   '+55 (71) ...' -> matches normalized
  --   '55718189...' (old no-9) -> matches normalized (format_brazilian_phone adds the 9)
  SELECT id INTO v_lead_id 
  FROM public.leads 
  WHERE public.format_brazilian_phone(phone) = v_formatted_phone
  ORDER BY created_at DESC -- Prefer most recent logic if multiple exist
  LIMIT 1;
  
  IF v_lead_id IS NULL THEN
    -- New lead - get next user from round-robin
    v_assigned_user := public.get_next_assigned_user();
    
    INSERT INTO public.leads (phone, name, status, assigned_to)
    VALUES (v_formatted_phone, COALESCE(p_name, v_formatted_phone), 'novo', v_assigned_user)
    RETURNING id INTO v_lead_id;
  ELSE
    -- Existing lead found (maybe with old format)
    -- SELF-HEALING: Update the phone to the new clean format so next time lookup is fast
    UPDATE public.leads 
    SET 
      updated_at = now(),
      phone = v_formatted_phone -- Standardize it now
    WHERE id = v_lead_id;
  END IF;
  
  RETURN v_lead_id;
END;
$function$;
