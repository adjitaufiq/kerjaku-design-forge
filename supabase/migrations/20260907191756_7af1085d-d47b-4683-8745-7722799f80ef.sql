CREATE TABLE public.ai_design_concepts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.ai_generations(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.ai_consultations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  philosophy TEXT,
  style TEXT,
  color_palette TEXT,
  material_direction TEXT,
  furniture_recommendation TEXT,
  lighting_recommendation TEXT,
  reason TEXT,
  room_analysis JSONB,
  opportunity JSONB,
  materials JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_of_work JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline_estimate TEXT,
  next_action TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  customer_interest TEXT,
  customer_notes TEXT,
  revision_request TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  proposal_id UUID,
  image_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_design_concepts_status_check CHECK (status IN ('DRAFT','DESIGNER_REVIEW','PRESENTED','CUSTOMER_REVISION','APPROVED','CONVERTED'))
);
CREATE INDEX ai_design_concepts_project_idx ON public.ai_design_concepts (project_id, created_at DESC);
CREATE INDEX ai_design_concepts_workspace_idx ON public.ai_design_concepts (workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_design_concepts TO authenticated;
GRANT ALL ON public.ai_design_concepts TO service_role;
ALTER TABLE public.ai_design_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage design concepts" ON public.ai_design_concepts
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE TABLE public.ai_libraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_libraries_kind_check CHECK (kind IN ('CONCEPT_TEMPLATE','DESIGN_STYLE','MATERIAL','PROPOSAL_TEMPLATE'))
);
CREATE INDEX ai_libraries_workspace_idx ON public.ai_libraries (workspace_id, kind, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_libraries TO authenticated;
GRANT ALL ON public.ai_libraries TO service_role;
ALTER TABLE public.ai_libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members read libraries" ON public.ai_libraries
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workshop admins manage libraries" ON public.ai_libraries
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, 'admin_workshop'))
  WITH CHECK (public.has_workspace_role(workspace_id, 'admin_workshop'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_ai_design_concepts_updated_at
  BEFORE UPDATE ON public.ai_design_concepts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();