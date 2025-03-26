-- Disable Row Level Security for chat_messages
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;

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