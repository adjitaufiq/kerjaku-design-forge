CREATE TABLE IF NOT EXISTS public.design_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  space_category text,
  room_type text,
  purpose text,
  budget_range text,
  preferred_style text,
  customer_priority text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_briefs TO authenticated;
GRANT ALL ON public.design_briefs TO service_role;
ALTER TABLE public.design_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "design briefs readable by members" ON public.design_briefs
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "design briefs managed by members" ON public.design_briefs
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE TRIGGER design_briefs_set_updated_at BEFORE UPDATE ON public.design_briefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  brief_id uuid REFERENCES public.design_briefs(id) ON DELETE SET NULL,
  input_image_url text,
  room_analysis jsonb,
  opportunity jsonb,
  recommendation jsonb,
  alternatives jsonb,
  sales_insight jsonb,
  selected_concept text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_consultations TO authenticated;
GRANT ALL ON public.ai_consultations TO service_role;
ALTER TABLE public.ai_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai consultations readable by members" ON public.ai_consultations
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ai consultations managed by members" ON public.ai_consultations
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS ai_consultations_project_idx ON public.ai_consultations(project_id);
CREATE TRIGGER ai_consultations_set_updated_at BEFORE UPDATE ON public.ai_consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'CUSTOMER',
  role text NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai chat readable by members" ON public.ai_chat_messages
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "ai chat managed by members" ON public.ai_chat_messages
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE INDEX IF NOT EXISTS ai_chat_messages_project_idx ON public.ai_chat_messages(project_id, created_at);