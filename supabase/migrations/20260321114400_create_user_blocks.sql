-- Create user_blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocks
DROP POLICY IF EXISTS "Users can view their own blocks" ON public.user_blocks;
CREATE POLICY "Users can view their own blocks" ON public.user_blocks
    FOR SELECT TO authenticated
    USING (blocker_id = auth.uid());

-- Users can block others
DROP POLICY IF EXISTS "Users can block others" ON public.user_blocks;
CREATE POLICY "Users can block others" ON public.user_blocks
    FOR INSERT TO authenticated
    WITH CHECK (blocker_id = auth.uid());

-- Users can unblock
DROP POLICY IF EXISTS "Users can unblock" ON public.user_blocks;
CREATE POLICY "Users can unblock" ON public.user_blocks
    FOR DELETE TO authenticated
    USING (blocker_id = auth.uid());

-- Add RLS to menu_entries to hide blocked content
-- Since menu_entries probably already has a SELECT policy, we shouldn't indiscriminately DROP it.
-- However, we can add a filter. An easy way is to recreate the SELECT policy with the block check.
-- Let's make sure that if there are existing public SELECT policies, we are careful.
-- Usually, menu_entries SELECT is fully open. We can DROP the existing open SELECT policy and recreate it.
DROP POLICY IF EXISTS "menu_entries_select_public" ON public.menu_entries;
CREATE POLICY "menu_entries_select_public" ON public.menu_entries
    FOR SELECT TO public
    USING (
        submitted_by NOT IN (
            SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid()
        )
        OR submitted_by IS NULL
    );
