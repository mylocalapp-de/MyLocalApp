-- Add is_verein flag to organizations (Vereine filter)

-- Add the boolean flag
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS is_verein boolean NOT NULL DEFAULT false;

-- Document the column
COMMENT ON COLUMN public.organizations.is_verein IS 'Marks organization as a registered club (Verein).';

-- Backfill existing organizations based on the previous name heuristic ("e.V.")
UPDATE public.organizations
SET is_verein = true
WHERE is_verein = false
  AND name ~* 'e\.[[:space:]]*v\.';

-- Index to speed up Vereine list (WHERE is_verein ORDER BY name)
CREATE INDEX IF NOT EXISTS idx_organizations_verein_name
  ON public.organizations (name)
  WHERE is_verein;
