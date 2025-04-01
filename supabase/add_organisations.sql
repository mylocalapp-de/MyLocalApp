-- supabase/add_organizations.sql
-- Adds tables and logic for Organizations feature

BEGIN;

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT, -- URL to the organization's logo
  admin_id UUID NOT NULL REFERENCES public.profiles(id), -- User who created the org initially
  invite_code TEXT UNIQUE, -- Unique code for joining
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE public.organizations IS 'Stores information about organizations (clubs, companies, etc.).';
COMMENT ON COLUMN public.organizations.invite_code IS 'Unique, shareable code for users to join the organization.';

-- 2. Organization Members Table (Junction Table)
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')), -- Role within the org
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (organization_id, user_id) -- Ensure user is only in org once
);

COMMENT ON TABLE public.organization_members IS 'Links users (profiles) to organizations and defines their role.';

-- 3. Helper Function to Generate Unique Invite Codes
CREATE OR REPLACE FUNCTION public.generate_unique_invite_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  found BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    -- Check if it already exists
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE invite_code = new_code) INTO found;
    EXIT WHEN NOT found;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION public.generate_unique_invite_code() IS 'Generates a unique 8-character invite code for organizations.';

-- Assign invite code automatically on organization creation using the function
ALTER TABLE public.organizations
  ALTER COLUMN invite_code SET DEFAULT public.generate_unique_invite_code();


-- 4. Add organization_id to Content Tables
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.chat_groups
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
  -- We can potentially remove the 'admin_id' from chat_groups if only org admins can create/manage them
  -- For now, keep both, assuming personal broadcast groups might still exist? Or redefine logic.
  -- Let's assume only Orgs can create broadcast groups now.
  -- ALTER TABLE public.chat_groups DROP COLUMN IF EXISTS admin_id; -- Consider this later if needed.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;


-- 5. Update RLS Policies

-- RLS for organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access for organizations" ON public.organizations;
DROP POLICY IF EXISTS "Allow members to read their organization details" ON public.organizations;
DROP POLICY IF EXISTS "Allow admin to manage their organization" ON public.organizations;
DROP POLICY IF EXISTS "Allow authenticated users to create organizations" ON public.organizations;

CREATE POLICY "Allow members to read their organization details" ON public.organizations
  FOR SELECT TO authenticated USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow admin to manage their organization" ON public.organizations
  FOR UPDATE TO authenticated USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin')
  ) WITH CHECK ( -- Admins can update name, logo but not admin_id or invite_code here
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin')
  );
  -- Note: Deletion might need cascade or specific handling for members/content.

CREATE POLICY "Allow authenticated users to create organizations" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid()); -- User creating is the initial admin

-- RLS for organization_members table
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow members to view membership of their orgs" ON public.organization_members;
DROP POLICY IF EXISTS "Allow users to view their own memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Allow admin to manage members in their org" ON public.organization_members;
DROP POLICY IF EXISTS "Allow users to join an organization (insert)" ON public.organization_members;
DROP POLICY IF EXISTS "Allow users to leave an organization (delete)" ON public.organization_members;

-- Renamed policy and fixed recursion
DROP POLICY IF EXISTS "Allow users to view their own membership record" ON public.organization_members;
CREATE POLICY "Allow users to view their own membership records" ON public.organization_members
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() -- User can only see their own row(s) in this table directly.
  );

-- Allow admins to manage roles or remove members (but not themselves easily via this policy)
CREATE POLICY "Allow admin to manage members in their org" ON public.organization_members
  FOR UPDATE TO authenticated USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin')
    AND user_id != auth.uid() -- Admin cannot change their own role/delete themselves with this policy
  ) WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow users to insert their own membership record when joining
CREATE POLICY "Allow users to join an organization (insert)" ON public.organization_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Allow users to delete their *own* membership record to leave (admins need separate handling if they are last admin)
CREATE POLICY "Allow users to leave an organization (delete)" ON public.organization_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());
  -- TODO: Add check/trigger to prevent last admin from leaving?

-- Update RLS for Content Creation (Example for Articles)
DROP POLICY IF EXISTS "Authenticated users can create articles" ON public.articles;
CREATE POLICY "Authenticated users can create articles" ON public.articles
  FOR INSERT TO authenticated WITH CHECK (
    (
      -- Personal post: author_id is user, organization_id is NULL
      author_id = auth.uid() AND organization_id IS NULL
    ) OR (
      -- Organization post: user is member of organization_id, author_id is user
      author_id = auth.uid() AND organization_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.organization_members mem
        WHERE mem.organization_id = articles.organization_id AND mem.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Authors/Org Members can update their articles" ON public.articles;
DROP POLICY IF EXISTS "Authors can update their own articles" ON public.articles; -- old name
CREATE POLICY "Authors/Org Members can update their articles" ON public.articles
  FOR UPDATE TO authenticated USING (
     (author_id = auth.uid() AND organization_id IS NULL) -- Personal post owned by user
     OR
     (organization_id IS NOT NULL AND EXISTS ( -- Org post, user is member
        SELECT 1 FROM public.organization_members mem
        WHERE mem.organization_id = articles.organization_id AND mem.user_id = auth.uid()
        -- Add role check if only admins can edit org posts: AND mem.role = 'admin'
      ))
  ) WITH CHECK (
     (author_id = auth.uid() AND organization_id IS NULL)
     OR
     (organization_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_members mem
        WHERE mem.organization_id = articles.organization_id AND mem.user_id = auth.uid()
      ))
  );

DROP POLICY IF EXISTS "Authors/Org Members can delete their articles" ON public.articles;
DROP POLICY IF EXISTS "Authors can delete their own articles" ON public.articles; -- old name
CREATE POLICY "Authors/Org Members can delete their articles" ON public.articles
  FOR DELETE TO authenticated USING (
     (author_id = auth.uid() AND organization_id IS NULL) -- Personal post owned by user
     OR
     (organization_id IS NOT NULL AND EXISTS ( -- Org post, user is member (or admin)
        SELECT 1 FROM public.organization_members mem
        WHERE mem.organization_id = articles.organization_id AND mem.user_id = auth.uid()
        -- Add role check if only admins can delete org posts: AND mem.role = 'admin'
      ))
  );

-- Similar policy updates needed for chat_groups (creation/update/delete) and events (creation/update/delete)
-- For chat_groups (broadcast): Allow only org members (maybe admins?) to create/manage if associated with org.
DROP POLICY IF EXISTS "Allow authenticated users to create open groups" ON public.chat_groups; -- Keep? Or deprecate personal groups? Assume keep for now.
CREATE POLICY "Allow authenticated users to create open groups" ON public.chat_groups
  FOR INSERT TO authenticated WITH CHECK (type = 'open_group' AND organization_id IS NULL); -- Personal open group

DROP POLICY IF EXISTS "Allow org members/admins to create broadcast groups for org" ON public.chat_groups;
DROP POLICY IF EXISTS "Allow admins to create broadcast groups" ON public.chat_groups; -- old name
CREATE POLICY "Allow org members/admins to create broadcast groups for org" ON public.chat_groups
  FOR INSERT TO authenticated WITH CHECK (
    type = 'broadcast' AND organization_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.organization_members mem
      WHERE mem.organization_id = chat_groups.organization_id AND mem.user_id = auth.uid()
      -- Add role check if needed: AND mem.role = 'admin'
    )
  );
-- Add policies for updating/deleting org broadcast groups based on membership/role

-- For Events:
-- Similar policies for creation/update/delete based on organizer_id (user) and organization_id (org)


-- 6. Update Views to Show Organization Name

-- Update article_listings view
DROP VIEW IF EXISTS public.article_listings;
CREATE OR REPLACE VIEW public.article_listings AS
  SELECT
    a.id,
    a.title,
    format_date_german(a.published_at) as date,
    LEFT(a.content, 100) || (CASE WHEN length(a.content) > 100 THEN '...' ELSE '' END) as content,
    a.type,
    a.published_at,
    a.author_id, -- Keep author_id if needed for frontend logic
    a.organization_id,
    -- Display org name if available, otherwise author's name
    COALESCE(org.name, p.display_name, 'Redaktion') as author_name,
    -- Indicate if it's an org post
    (a.organization_id IS NOT NULL) as is_organization_post
  FROM
    public.articles a
  LEFT JOIN
    public.profiles p ON a.author_id = p.id
  LEFT JOIN
    public.organizations org ON a.organization_id = org.id
  WHERE
    a.is_published = true
  ORDER BY
    a.published_at DESC;

-- Update chat_group_listings view
DROP VIEW IF EXISTS public.chat_group_listings;
DROP VIEW IF EXISTS public.chat_group_listings;
CREATE OR REPLACE VIEW public.chat_group_listings AS
  WITH LastMessages AS (
    SELECT
      chat_group_id,
      text,
      created_at,
      user_id,
      ROW_NUMBER() OVER(PARTITION BY chat_group_id ORDER BY created_at DESC) as rn
    FROM public.chat_messages
  )
  SELECT
    g.id,
    g.name,
    g.type,
    g.tags,
    g.organization_id,
    g.is_active,
    lm.text as last_message,
    format_time_german(lm.created_at) as last_message_time,
    lm.created_at as last_message_timestamp,
    -- Display org name if it's an org group, otherwise maybe group name or admin?
    COALESCE(org.name, g.name) as display_source,
    -- Show sender name for last message (could be org name if org sent it?)
    COALESCE(sender_org.name, sender_profile.display_name, 'System') as last_message_sender_name,
    -- Unread count still complex with RLS, keep placeholder
    0 as unread_count
  FROM
    public.chat_groups g
  LEFT JOIN
    LastMessages lm ON g.id = lm.chat_group_id AND lm.rn = 1
  LEFT JOIN
    public.organizations org ON g.organization_id = org.id -- Group's associated org
  LEFT JOIN
    public.profiles sender_profile ON lm.user_id = sender_profile.id AND g.organization_id IS NULL -- Sender profile if personal message
  LEFT JOIN
    public.organizations sender_org ON g.organization_id = sender_org.id -- Assume message in org group comes from org name? Needs refinement.
  WHERE
    g.is_active = true AND g.type != 'bot' -- Exclude bot type
  ORDER BY
    lm.created_at DESC NULLS LAST;

-- Update event_listings view
DROP VIEW IF EXISTS public.event_listings;
CREATE OR REPLACE VIEW public.event_listings AS
  SELECT
    e.id,
    e.title,
    e.description,
    e.date,
    format_date_german(e.date) as formatted_date,
    e.time,
    e.end_time,
    e.location,
    e.category,
    e.image_url,
    e.organizer_id,
    e.organization_id,
    -- Display org name if available, otherwise organizer's name
    COALESCE(org.name, p.display_name, 'Unbekannt') as organizer_name,
    -- Indicate if it's an org event
    (e.organization_id IS NOT NULL) as is_organization_event,
    -- Attendee counts might need adjustment if view uses a function; ensure function handles RLS
    (SELECT get_event_attendees(e.id)) as attendees -- Assuming this exists and is RLS-aware
  FROM
    public.events e
  LEFT JOIN
    public.profiles p ON e.organizer_id = p.id
  LEFT JOIN
    public.organizations org ON e.organization_id = org.id
  WHERE
    e.is_published = true
  ORDER BY
    e.date ASC, e.time ASC;


-- 7. Trigger to Add Creator as First Admin Member
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the user who created the organization as the first admin member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.admin_id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- 8. Grant Permissions
GRANT SELECT ON public.organizations TO authenticated;
GRANT INSERT, UPDATE ON public.organizations TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;

GRANT EXECUTE ON FUNCTION public.generate_unique_invite_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_organization() TO postgres; -- Trigger function

-- Update permissions for content tables if needed (e.g., SELECT on organization_id)
GRANT SELECT (organization_id) ON public.articles TO anon, authenticated;
GRANT UPDATE (organization_id) ON public.articles TO authenticated; -- Allow setting org ID on update?

GRANT SELECT (organization_id) ON public.chat_groups TO authenticated;
GRANT UPDATE (organization_id) ON public.chat_groups TO authenticated;

GRANT SELECT (organization_id) ON public.events TO anon, authenticated;
GRANT UPDATE (organization_id) ON public.events TO authenticated;

-- Grant SELECT on updated views
GRANT SELECT ON public.article_listings TO anon, authenticated;
GRANT SELECT ON public.chat_group_listings TO authenticated;
GRANT SELECT ON public.event_listings TO anon, authenticated;


COMMIT;