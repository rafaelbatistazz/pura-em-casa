-- Create function to adjust timestamp
CREATE OR REPLACE FUNCTION public.adjust_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Subtract 3 hours from the incoming timestamp to force it to match Brazil time
  -- This is necessary because the application treats the stored time as UTC for display
  NEW.timestamp := NEW.timestamp - INTERVAL '3 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run before insert
DROP TRIGGER IF EXISTS adjust_timestamp_before_insert ON public.messages;
CREATE TRIGGER adjust_timestamp_before_insert
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.adjust_message_timestamp();
