-- Create message_shortcuts table for quick message templates
CREATE TABLE public.message_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(trigger)
);

-- Enable RLS
ALTER TABLE public.message_shortcuts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view shortcuts
CREATE POLICY "Authenticated users can view shortcuts"
ON public.message_shortcuts
FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage shortcuts
CREATE POLICY "Admins can insert shortcuts"
ON public.message_shortcuts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update shortcuts"
ON public.message_shortcuts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete shortcuts"
ON public.message_shortcuts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));