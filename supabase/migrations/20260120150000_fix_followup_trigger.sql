-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Create or Replace the Trigger Function
CREATE OR REPLACE FUNCTION public.update_lead_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Logic:
  -- 1. Always update updated_at (crucial for timer)
  -- 2. Update direction
  -- 3. Manage Stage:
  --    - If Inbound (Client): Reset to 0
  --    - If Outbound (AI):
  --       - If sender is 'AI Follow-up', DON'T reset (it's part of the flow)
  --       - If sender is 'AI Agent' (Standard Chat), Reset to 0 (Start over wait time)
  --       - If sender is 'System' (e.g. status update), maybe reset? Let's assume yes.

  UPDATE public.leads
  SET
    last_message_direction = NEW.direction,
    updated_at = NOW(),
    followup_stage = CASE
        WHEN NEW.direction = 'inbound' THEN 0
        WHEN NEW.direction = 'outbound' AND NEW.sender_name <> 'AI Follow-up' THEN 0
        ELSE followup_stage -- Keep existing stage if it's an AI Follow-up message
    END
  WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS update_lead_on_message_trigger ON public.messages;
CREATE TRIGGER update_lead_on_message_trigger
  AFTER INSERT
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_on_message();

-- 3. Schedule the Cron Job (Idempotent-ish)
-- First unschedule to avoid duplicates if re-running
SELECT cron.unschedule('check_followups_job');

SELECT cron.schedule(
    'check_followups_job',
    '* * * * *', -- Every minute
    $$
    SELECT net.http_post(
        url := 'https://ragnzmmnqtogmodkfayj.supabase.co/functions/v1/check_followups',
        headers := '{"Content-Type": "application/json", "x-cron-auth": "fc-cron-secure-token-v1"}'::jsonb
    )
    $$
);
