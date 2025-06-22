-- Insert a dummy reply for testing analytics
-- Replace 'YOUR_USER_ID' with your actual user ID
-- Replace 'YOUR_CAMPAIGN_ID' with your actual campaign ID

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
) VALUES (
    gen_random_uuid(), -- dummy email_id
    '69c27965-0cf9-4549-bfef-ad2f73aa0c08', -- your user ID from the logs
    '630b62e0-914f-4d91-af4d-2fbbfe939543', -- your campaign ID from the logs
    'test_message_id_123',
    'test_thread_id_123',
    'This is a test reply snippet for testing analytics functionality.',
    'test@example.com',
    NOW(),
    'interested'
); 