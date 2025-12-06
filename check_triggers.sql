SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgrelid = 'public.messages'::regclass;
