ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'MEETING';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'PRODUCTION';

CREATE TABLE IF NOT EXISTS public.proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  pdf_url text,
  total_amount numeric NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_versions TO authenticated;
GRANT ALL ON public.proposal_versions TO service_role;

ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal versions readable by members" ON public.proposal_versions
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "proposal versions insert by members" ON public.proposal_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "proposal versions delete by admin" ON public.proposal_versions
  FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, 'admin_workshop'::app_role));

CREATE INDEX IF NOT EXISTS proposal_versions_proposal_idx ON public.proposal_versions(proposal_id);
CREATE UNIQUE INDEX IF NOT EXISTS proposals_share_token_idx ON public.proposals(share_token);