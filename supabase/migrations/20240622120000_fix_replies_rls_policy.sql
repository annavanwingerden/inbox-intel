-- Fix RLS policy on replies table to ensure proper access
-- Drop the existing policy
DROP POLICY IF EXISTS "Allow full access to own replies" ON replies;
-- Create a more comprehensive policy that allows proper access
CREATE POLICY "Allow users to access their own replies" ON replies FOR ALL USING (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
) WITH CHECK (
    auth.uid() = user_id
    OR auth.role() = 'service_role'
);
-- Add a specific policy for service role operations (like reply-poller)
CREATE POLICY "Allow service role full access" ON replies FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- Insert a dummy reply for testing analytics
INSERT INTO replies (
        email_id,
        user_id,
        campaign_id,
        message_id,
        thread_id,
        snippet,
        from_address,
        received_at,
        outcome_tag
    )
VALUES (
        gen_random_uuid(),
        -- dummy email_id
        '69c27965-0cf9-4549-bfef-ad2f73aa0c08',
        -- your user ID from the logs
        '630b62e0-914f-4d91-af4d-2fbbfe939543',
        -- your campaign ID from the logs
        'test_message_id_123',
        'test_thread_id_123',
        'This is a test reply snippet for testing analytics functionality.',
        'test@example.com',
        NOW(),
        'interested'
    );