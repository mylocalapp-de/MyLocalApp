-- Disable Row Level Security for chat_messages
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

-- Create helper functions for application to use

-- Function to disable RLS on chat_groups table
CREATE OR REPLACE FUNCTION public.disable_rls_for_chat_groups()
RETURNS void AS $$
BEGIN
    -- Disable RLS for chat_groups
    ALTER TABLE public.chat_groups DISABLE ROW LEVEL SECURITY;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set admin for a chat group directly
CREATE OR REPLACE FUNCTION public.set_chat_group_admin(group_id UUID, admin_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.chat_groups 
    SET admin_id = admin_id
    WHERE id = group_id;
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manually set admin_id for broadcast groups if needed
-- Get first user
DO $$
DECLARE
    first_user_id UUID;
BEGIN
    -- Get the first user from app_users table
    SELECT id INTO first_user_id FROM public.app_users ORDER BY created_at LIMIT 1;
    
    -- If we found a user, assign them as admin to broadcast groups
    IF first_user_id IS NOT NULL THEN
        RAISE NOTICE 'Setting admin_id to %', first_user_id;
        
        UPDATE public.chat_groups 
        SET admin_id = first_user_id
        WHERE type = 'broadcast' AND admin_id IS NULL;
    ELSE
        RAISE NOTICE 'No users found in app_users table';
    END IF;
END $$;

-- Show all chat groups with their admin_id
SELECT id, name, type, admin_id FROM public.chat_groups;

-- Grant access to RPC functions
GRANT EXECUTE ON FUNCTION public.disable_rls_for_chat_groups() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_chat_group_admin(UUID, UUID) TO anon, authenticated; 