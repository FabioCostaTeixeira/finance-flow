
-- Create user_permissions table to store per-user page access
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Master can do everything
CREATE POLICY "Master can manage all permissions"
  ON public.user_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'master'));

-- Users can read their own permissions
CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a helper function to check if a user has permission for a module
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Master always has access
  SELECT CASE
    WHEN public.has_role(_user_id, 'master') THEN true
    ELSE COALESCE(
      (SELECT allowed FROM public.user_permissions WHERE user_id = _user_id AND module_key = _module_key),
      false
    )
  END
$$;
