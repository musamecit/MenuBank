-- Add notifications_menu_enabled to user_profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'notifications_menu_enabled'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN notifications_menu_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
