
ALTER TABLE public.ai_generations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS input_image_url text,
  ADD COLUMN IF NOT EXISTS reference_image_url text,
  ADD COLUMN IF NOT EXISTS prompt_used text,
  ADD COLUMN IF NOT EXISTS output_image_url text,
  ADD COLUMN IF NOT EXISTS generation_type text NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS style text,
  ADD COLUMN IF NOT EXISTS color_preference text,
  ADD COLUMN IF NOT EXISTS instruction text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS ai_generations_project_idx ON public.ai_generations(project_id);

CREATE TABLE IF NOT EXISTS public.ai_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  generation_id uuid NOT NULL REFERENCES public.ai_generations(id) ON DELETE CASCADE,
  instruction text NOT NULL,
  previous_image_url text,
  new_image_url text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_revisions TO authenticated;
GRANT ALL ON public.ai_revisions TO service_role;
ALTER TABLE public.ai_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai revisions readable by members" ON public.ai_revisions
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ai revisions insert by designers" ON public.ai_revisions
  FOR INSERT TO authenticated WITH CHECK (
    public.has_workspace_role(workspace_id, 'admin_workshop'::app_role)
    OR public.has_workspace_role(workspace_id, 'designer'::app_role)
  );
CREATE INDEX IF NOT EXISTS ai_revisions_generation_idx ON public.ai_revisions(generation_id);

CREATE TABLE IF NOT EXISTS public.ai_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  generation_id uuid REFERENCES public.ai_generations(id) ON DELETE SET NULL,
  credit_used integer NOT NULL DEFAULT 0,
  transaction_type text NOT NULL DEFAULT 'STANDARD',
  status text NOT NULL DEFAULT 'COMPLETED',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_transactions TO authenticated;
GRANT ALL ON public.ai_transactions TO service_role;
ALTER TABLE public.ai_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai transactions readable by members" ON public.ai_transactions
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE UNIQUE INDEX IF NOT EXISTS ai_transactions_generation_idx
  ON public.ai_transactions(generation_id) WHERE generation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  default_model text NOT NULL DEFAULT 'google/gemini-3-pro-image',
  cost_preview integer NOT NULL DEFAULT 1,
  cost_standard integer NOT NULL DEFAULT 2,
  cost_high integer NOT NULL DEFAULT 3,
  cost_revision integer NOT NULL DEFAULT 2,
  daily_limit integer NOT NULL DEFAULT 20,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai settings readable by members" ON public.ai_settings
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ai settings managed by admin" ON public.ai_settings
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, 'admin_workshop'::app_role))
  WITH CHECK (public.has_workspace_role(workspace_id, 'admin_workshop'::app_role));
CREATE TRIGGER ai_settings_set_updated_at BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
