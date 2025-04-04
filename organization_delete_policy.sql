-- Add a new RLS policy to allow org admins to delete organizations
DROP POLICY IF EXISTS "Allow admin to delete their organization" ON public.organizations;

CREATE POLICY "Allow admin to delete their organization" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_org_member_admin(auth.uid(), id));

COMMENT ON POLICY "Allow admin to delete their organization" ON public.organizations
  IS 'Allows organization admins to delete their organizations.';
