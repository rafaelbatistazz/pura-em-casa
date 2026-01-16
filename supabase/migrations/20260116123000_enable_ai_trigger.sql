
-- Enable pg_net if not already (redundant but safe)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Function to trigger Edge Function
CREATE OR REPLACE FUNCTION public.notify_ai_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_instance_name text;
  v_ai_enabled boolean;
  v_payload jsonb;
BEGIN
  -- Only trigger for INBOUND messages (user to system)
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  -- Check if AI is enabled for this lead
  SELECT ai_enabled INTO v_ai_enabled
  FROM public.leads
  WHERE id = NEW.lead_id;

  -- Default to true if null (optional, based on your logic)
  IF v_ai_enabled IS FALSE THEN
    RETURN NEW;
  END IF;

  -- Fetch instance name from config (optional, can be passed or handled by EF)
  -- For now, we'll let EF handle default or fetch.
  
  -- Prepare Payload
  v_payload := jsonb_build_object(
    'leadId', NEW.lead_id,
    'message', NEW.message_text,
    'media_url', NEW.media_url,
    'media_type', NEW.media_type
  );

  -- Call Edge Function via pg_net
  -- Note: Replace PROJECT_REF_URL with dynamic if possible, but usually hardcoded or via secret.
  -- URL: https://ragnzmmnqtogmodkfayj.supabase.co/functions/v1/ai-chat
  -- We use net.http_post
  PERFORM net.http_post(
    url := 'https://ragnzmmnqtogmodkfayj.supabase.co/functions/v1/ai-chat',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('request.jwt.claim.sub', true) || '"}'::jsonb, 
    -- Auth might need Service Role if triggered by DB system context. 
    -- Actually better to use Anon Key or Service Key. 
    -- Since we can't easily access secrets in SQL without vault, we often use anon key if RLS allows, or service header.
    -- However, for simplicity in quick fix, let's try without specific Auth header first if function allows, 
    -- OR better: The function 'ai-chat' might require Auth.
    -- Let's use a hardcoded Service Key? NO, that's unsafe.
    -- Best practice: The Function code I deployed has verify_jwt: false (I hope? No, I used --no-verify-jwt flag).
    -- So no auth header needed, or just standard.
    
    body := v_payload
  );

  RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS on_message_created_notify_ai ON public.messages;

CREATE TRIGGER on_message_created_notify_ai
  AFTER INSERT
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ai_chat();
